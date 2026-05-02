require("dotenv").config();
const axios = require("axios");

async function getAIReply(message, personality = "friendly") {
  let systemPrompt = "";

  if (personality === "flirty") {
    systemPrompt = "You are playful, flirty, and human-like.";
  } else if (personality === "professional") {
    systemPrompt = "You are formal and helpful.";
  } else {
    systemPrompt = "You are friendly, natural, and chat like a real human on WhatsApp. Keep replies short and engaging.";
  }

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data.choices[0].message.content;
  } catch (err) {
    console.log("AI ERROR:", err.response?.data || err.message);
    return "⚠️ AI not responding. Check API key or credits.";
  }
}

module.exports = { getAIReply };