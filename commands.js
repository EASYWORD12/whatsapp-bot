function handleCommand(text, chatSettings) {
  if (text === "/chatbot on") {
    chatSettings.chatbot = true;
    return "✅ Chatbot enabled";
  }

  if (text === "/chatbot off") {
    chatSettings.chatbot = false;
    return "❌ Chatbot disabled";
  }

  if (text === "/chatbot group on") {
    chatSettings.groupMode = true;
    return "✅ Group mode ON";
  }

  if (text === "/chatbot group off") {
    chatSettings.groupMode = false;
    return "❌ Group mode OFF";
  }

  return null;
}

module.exports = { handleCommand };