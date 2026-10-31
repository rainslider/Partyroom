// Partyroom server: no dependencies, only Node 18+.
// Players connect with Server-Sent Events (GET /party/events) and send messages with POST /party/send.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const INDEX = [path.join(__dirname, "index.html"), path.join(__dirname, "public", "index.html")].find((f) => fs.existsSync(f)) || path.join(__dirname, "index.html");
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_PARTIES = 2000;
const MAX_MEMBERS = 20;

const parties = new Map(); // code -> { code, members: [client] } (members[0] is the host)

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let s = "";
    for (let i = 0; i < 5; i++) s += ALPHA[crypto.randomInt(ALPHA.length)];
    if (!parties.has(s)) return s;
  }
  return null;
}

function cleanName(v) {
  const n = String(v || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 20);
  return n || "Gast";
}

function sse(res, event, data) {
  res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");
}

function membersOf(p) {
  return p.members.map((m, i) => ({ id: m.id, name: m.name, c: m.c, host: i === 0 }));
}

function broadcast(p, event, data) {
  p.members.forEach((m) => sse(m.res, event, data));
}

function leave(client) {
  const p = client.party;
  if (!p) return;
  client.party = null;
  p.members = p.members.filter((m) => m !== client);
  if (p.members.length === 0) parties.delete(p.code);
  else broadcast(p, "members", membersOf(p));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname.replace(/\/+$/, "") || "/";

  if (route === "/") {
    res.writeHead(302, { Location: "/party" });
    return res.end();
  }
  if (route === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  if (route === "/party" && req.method === "GET") {
    fs.readFile(INDEX, (err, buf) => {
      if (err) { res.writeHead(500); return res.end("index.html ontbreekt"); }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(buf);
    });
    return;
  }

  if (route === "/party/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 600000\n\n");

    const mode = url.searchParams.get("mode");
    const client = {
      id: crypto.randomBytes(6).toString("hex"),
      token: crypto.randomBytes(16).toString("hex"),
      name: cleanName(url.searchParams.get("name")),
      c: Math.abs(parseInt(url.searchParams.get("c"), 10)) % 8 || 0,
      res,
      party: null,
      lastChat: 0,
    };

    function fail(message) {
      sse(res, "problem", { message });
      res.end();
    }

    let p;
    if (mode === "create") {
      if (parties.size >= MAX_PARTIES) return fail("De server is vol. Probeer het later nog eens.");
      const code = newCode();
      if (!code) return fail("Kon geen code maken. Probeer het nog eens.");
      p = { code, members: [] };
      parties.set(code, p);
    } else if (mode === "join") {
      const code = String(url.searchParams.get("code") || "").toUpperCase();
      p = parties.get(code);
      if (!p) return fail("Geen party gevonden met code " + code.slice(0, 5) + ".");
      if (p.members.length >= MAX_MEMBERS) return fail("Deze party zit vol.");
    } else {
      return fail("Onbekende actie.");
    }

    client.party = p;
    p.members.push(client);
    clients.set(client.id, client);
    sse(res, "joined", { id: client.id, token: client.token, code: p.code, host: p.members[0] === client });
    broadcast(p, "members", membersOf(p));

    const ping = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(ping);
      clients.delete(client.id);
      leave(client);
    });
    return;
  }

  if (route === "/party/send" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2048) req.destroy();
    });
    req.on("end", () => {
      let m;
      try { m = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end(); }
      const client = m && clients.get(m.id);
      if (!client || client.token !== m.token || !client.party) { res.writeHead(403); return res.end(); }
      if (m.t === "chat") {
        const text = String(m.text || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
        const now = Date.now();
        if (!text || now - client.lastChat < 300) { res.writeHead(429); return res.end(); }
        client.lastChat = now;
        broadcast(client.party, "chat", { id: client.id, name: client.name, c: client.c, text });
      } else if (m.t === "leave") {
        clients.delete(client.id);
        leave(client);
        client.res.end();
      }
      res.writeHead(204);
      res.end();
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Niet gevonden");
});

const clients = new Map(); // id -> client

server.listen(PORT, () => console.log("Partyroom draait op poort " + PORT + " (open /party)"));
module.exports = server;
