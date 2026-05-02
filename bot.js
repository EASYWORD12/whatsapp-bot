const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const qrcode = require("qrcode-terminal");
const { getAIReply } = require("./ai");
const { handleCommand } = require("./commands");

let settings = {};
let memory = {};

let messageBuffer = {};
let messageTimer = {};
let isReplying = {}; // 🔒 prevents loops

function loadFiles() {
  if (fs.existsSync("settings.json")) {
    settings = JSON.parse(fs.readFileSync("settings.json"));
  }
  if (fs.existsSync("memory.json")) {
    memory = JSON.parse(fs.readFileSync("memory.json"));
  }
}

function saveFiles() {
  fs.writeFileSync("settings.json", JSON.stringify(settings, null, 2));
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

async function startBot() {
  loadFiles();

  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    browser: ["Windows", "Chrome", "120.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // 🔥 CONNECTION HANDLER
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📱 Scan this QR code:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("❌ Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) startBot();
    }

    if (connection === "open") {
      console.log("✅ Bot connected successfully");
    }
  });

  // 🔥 REAL HUMAN AUTO-REPLY HANDLER
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // ❌ only process new messages
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message) return;

    // ❌ NEVER reply to your own messages
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    // ❌ ignore status
    if (from === "status@broadcast") return;

    const isGroup = from.endsWith("@g.us");

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    // init settings
    if (!settings[from]) {
      settings[from] = { chatbot: false, groupMode: false };
    }

    // ✅ commands (instant)
    const cmd = handleCommand(text, settings[from]);
    if (cmd) {
      saveFiles();
      await sock.sendMessage(from, { text: cmd });
      return;
    }

    // ❌ chatbot off → do nothing
    if (!settings[from].chatbot) return;

    // ❌ group control
    if (isGroup && !settings[from].groupMode) return;

    // 🔒 prevent multiple replies
    if (isReplying[from]) return;

    // 🧠 store messages
    if (!messageBuffer[from]) messageBuffer[from] = [];
    messageBuffer[from].push(text);

    // ⏱ reset timer if user keeps typing
    if (messageTimer[from]) clearTimeout(messageTimer[from]);

    messageTimer[from] = setTimeout(async () => {
      const combinedMessage = messageBuffer[from].join(" ");
      messageBuffer[from] = [];

      try {
        isReplying[from] = true;

        await sock.sendPresenceUpdate("composing", from);

        const reply = await getAIReply(combinedMessage);

        // 🧠 realistic delay based on message length
        const delay =
          Math.min(8000, combinedMessage.length * 50) + 2000;

        setTimeout(async () => {
          await sock.sendMessage(from, { text: reply });
          isReplying[from] = false;
        }, delay);

      } catch (err) {
        console.log("Reply error:", err);
        isReplying[from] = false;
      }

    }, 6000); // waits until user stops typing
  });
}

startBot();