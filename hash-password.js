const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
    console.log("Usage: node hash-password.js YOUR_PASSWORD");
    process.exit(1);
}

bcrypt.hash(password, 10)
    .then((hash) => {
        console.log("\nBcrypt Hash:");
        console.log(hash);
        console.log("");
    })
    .catch((error) => {
        console.error("Hash error:", error);
    }); 