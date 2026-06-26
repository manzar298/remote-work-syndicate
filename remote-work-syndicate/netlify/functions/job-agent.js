const { Anthropic } = require("@anthropic-ai/sdk");

exports.handler = async (event, context) => {
  // Now pulling the Table Name dynamically from your dashboard!
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
  const BASE_ID = process.env.BASE_ID;
  const TABLE_NAME = process.env.TABLE_NAME || "Table 1"; // Defaults to Table 1 if not set
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    // Uses encodeURIComponent to handle spaces dynamically
    const airtableRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` }
    });
    
    if (!airtableRes.ok) {
      throw new Error(`Airtable API returned status ${airtableRes.status}`);
    }
    
    const airtableData = await airtableRes.json();
    const activeRawJobs = airtableData.records.filter(r => r.fields.Status === 'Active');

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const optimizedJobs = await Promise.all(activeRawJobs.map(async (job) => {
      const rawFields = job.fields;

      const prompt = `
        You are the core talent acquisition AI agent for Remote Work Syndicate. Analyze this unoptimized job posting data:
        Title: "${rawFields['Job Title']}"
        Pay Scale: "${rawFields['Estimated Pay']}"
        Raw Tech Stack Info: "${rawFields['Primary Tech Stack'] || ''}"

        Tasks:
        1. Clean and elevate the Job Title to look pristine, modern, and highly professional.
        2. Standardize the pay scale expression to match the exact schema "$XX - $XX / hr" or "$XX / hr".
        3. Extract an array of exactly 3 to 5 lowercase or standardized camelcase technical skill badges.

        Return ONLY a raw, valid JSON object following this structural format. Do not surround it with markdown codeblocks like \`\`\`json, and write absolutely no conversational filler prose before or after:
        {
          "title": "Cleaned Title",
          "pay": "Standardized Pay",
          "skills": ["Skill1", "Skill2", "Skill3"]
        }
      `;

      const responseMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        temperature: 0,
        messages: [{ role: "user", content: prompt }]
      });

      const processedJSONString = responseMessage.content[0].text.trim();
      const cleanData = JSON.parse(processedJSONString);

      return {
        id: job.id,
        datePosted: rawFields['Date Posted'] || 'Recent',
        applyLink: rawFields['Apply Link'] || '#',
        ...cleanData
      };
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(optimizedJobs)
    };

  } catch (error) {
    console.error("Agent Execution Fail:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};