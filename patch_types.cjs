const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/sender: "assistant",/g, 'sender: "assistant" as "assistant",');
code = code.replace(/sender: "user",/g, 'sender: "user" as "user",');

fs.writeFileSync('src/App.tsx', code);
