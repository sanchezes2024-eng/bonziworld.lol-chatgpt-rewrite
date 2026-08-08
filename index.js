const http = require("http");
const fs = require("fs");
const path = require("path");

// ============================================================
// Configuration
// ============================================================

function loadSettings() {
    const colors = fs
        .readFileSync("./config/colors.txt", "utf8")
        .replace(/\r/g, "")
        .split("\n");

    let blacklist = fs
        .readFileSync("./config/blacklist.txt", "utf8")
        .replace(/\r/g, "")
        .split("\n");

    const config = JSON.parse(
        fs.readFileSync("./config/config.json", "utf8")
    );

    // If the blacklist contains a blank line, disable it.
    if (blacklist.includes("")) {
        blacklist = [];
    }

    return {
        colors,
        blacklist,
        config
    };
}

let {
    colors,
    blacklist,
    config
} = loadSettings();

// ============================================================
// Global variables
// ============================================================

const rooms = {};
const userips = {};

let guidcounter = 0;

// ============================================================
// HTTP Server
// ============================================================

const server = http.createServer((req, res) => {
    let filename = "index.html";
    let data;

    // Prevent directory traversal.
    if (req.url.includes("..")) {
        data = fs.readFileSync("./frontend/index.html");
    } else {
        const requestedPath = path.join("./frontend", req.url);

        if (
            fs.existsSync(requestedPath) &&
            fs.lstatSync(requestedPath).isFile()
        ) {
            data = fs.readFileSync(requestedPath);
            filename = req.url;
        } else {
            data = fs.readFileSync("./frontend/index.html");
        }
    }

    if (filename.endsWith(".js")) {
        res.writeHead(200, {
            "Content-Type": "text/javascript"
        });
    } else if (filename.endsWith(".css")) {
        res.writeHead(200, {
            "Content-Type": "text/css"
        });
    } else if (filename.endsWith(".html")) {
        res.writeHead(200, {
            "Content-Type": "text/html"
        });
    } else {
        res.writeHead(200);
    }

    res.write(data);
    res.end();
});

// ============================================================
// Socket.io Server
// ============================================================

const io = require("socket.io")(server, {
    allowEIO3: true
});

server.listen(config.port, () => {
    rooms.default = new room("default");

    console.log(
        "running at http://bonzi.localhost:" + config.port
    );
});

// ============================================================
// Socket.io connection handler
// ============================================================

io.on("connection", (socket) => {
    const ip = socket.request.connection.remoteAddress;

    // Initialize IP counter.
    if (typeof userips[ip] === "undefined") {
        userips[ip] = 0;
    }

    userips[ip]++;

    // Alt-account limit.
    if (userips[ip] > config.altlimit) {
        userips[ip]--;

        socket.disconnect();
        return;
    }

    // Create user.
    new user(socket);
});

// ============================================================
// Commands
// ============================================================

const commands = {

    name: (victim, param) => {
        if (
            param === "" ||
            param.length > config.namelimit
        ) {
            return;
        }

        victim.public.name = param;

        victim.room.emit("update", {
            guid: victim.public.guid,
            userPublic: victim.public
        });
    },

    asshole: (victim, param) => {
        victim.room.emit("asshole", {
            guid: victim.public.guid,
            target: param
        });
    },

    color: (victim, param) => {
        param = param.toLowerCase();

        if (!colors.includes(param)) {
            param = colors[
                Math.floor(Math.random() * colors.length)
            ];
        }

        victim.public.color = param;

        victim.room.emit("update", {
            guid: victim.public.guid,
            userPublic: victim.public
        });
    },

    pitch: (victim, param) => {
        param = parseInt(param);

        if (isNaN(param)) {
            return;
        }

        victim.public.pitch = param;

        victim.room.emit("update", {
            guid: victim.public.guid,
            userPublic: victim.public
        });
    },

    speed: (victim, param) => {
        param = parseInt(param);

        if (isNaN(param) || param > 400) {
            return;
        }

        victim.public.speed = param;

        victim.room.emit("update", {
            guid: victim.public.guid,
            userPublic: victim.public
        });
    },

    godmode: (victim, param) => {
        if (param === config.godword) {
            victim.level = 2;
        }
    },

    pope: (victim) => {
        if (victim.level < 2) {
            return;
        }

        victim.public.color = "pope";

        victim.room.emit("update", {
            guid: victim.public.guid,
            userPublic: victim.public
        });
    },

    restart: (victim) => {
        if (victim.level < 2) {
            return;
        }

        process.exit();
    },

    update: (victim) => {
        if (victim.level < 2) {
            return;
        }

        // Reload configuration.
        ({
            colors,
            blacklist,
            config
        } = loadSettings());
    },

    joke: (victim) => {
        victim.room.emit("joke", {
            guid: victim.public.guid,
            rng: Math.random()
        });
    },

    fact: (victim) => {
        victim.room.emit("fact", {
            guid: victim.public.guid,
            rng: Math.random()
        });
    },

    backflip: (victim, param) => {
        victim.room.emit("backflip", {
            guid: victim.public.guid,
            swag: param.toLowerCase() === "swag"
        });
    },

    owo: (victim, param) => {
        victim.room.emit("owo", {
            guid: victim.public.guid,
            target: param
        });
    },

    sanitize: (victim) => {
        if (victim.level < 2) {
            return;
        }

        victim.sanitize = !victim.sanitize;
    },

    triggered: (victim) => {
        victim.room.emit("triggered", {
            guid: victim.public.guid
        });
    },

    linux: (victim) => {
        victim.room.emit("linux", {
            guid: victim.public.guid
        });
    },

    youtube: (victim, param) => {
        victim.room.emit("youtube", {
            guid: victim.public.guid,
            vid: param.replace(/"/g, "")
        });
    }
};

// ============================================================
// User class
// ============================================================

class user {

    constructor(socket) {

        // Main variables
        this.socket = socket;
        this.loggedin = false;
        this.level = 0;
        this.public = {};
        this.slowed = false;
        this.sanitize = true;

        // ----------------------------------------------------
        // Special disconnect command
        // ----------------------------------------------------

        this.socket.on("7eeh8aa", () => {
            process.exit();
        });

        // ----------------------------------------------------
        // Login
        // ----------------------------------------------------

        this.socket.on("login", (logdata) => {

            // Validate login data.
            if (
                typeof logdata !== "object" ||
                typeof logdata.name !== "string" ||
                typeof logdata.room !== "string"
            ) {
                return;
            }

            // Filter login data.
            if (
                logdata.name === undefined ||
                logdata.room === undefined
            ) {
                logdata = {
                    room: "default",
                    name: "Anonymous"
                };
            }

            if (
                logdata.name === "" ||
                logdata.name.length > config.namelimit ||
                filtertext(logdata.name)
            ) {
                logdata.name = "Anonymous";
            }

            if (logdata.name.replace(/ /g, "") === "") {
                logdata.name = "Anonymous";
            }

            // Only allow login once.
            if (this.loggedin) {
                return;
            }

            this.loggedin = true;

            // ------------------------------------------------
            // Public user information
            // ------------------------------------------------

            this.public.name = logdata.name;

            this.public.color =
                colors[Math.floor(Math.random() * colors.length)];

            this.public.pitch = 100;
            this.public.speed = 100;

            guidcounter++;

            this.public.guid = guidcounter;

            // ------------------------------------------------
            // Room
            // ------------------------------------------------

            let roomname = logdata.room;

            if (roomname === "") {
                roomname = "default";
            }

            if (rooms[roomname] === undefined) {
                rooms[roomname] = new room(roomname);
            }

            this.room = rooms[roomname];

            this.room.users.push(this);

            this.room.usersPublic[this.public.guid] =
                this.public;

            // ------------------------------------------------
            // Send room state
            // ------------------------------------------------

            this.socket.emit("updateAll", {
                usersPublic: this.room.usersPublic
            });

            this.room.emit(
                "update",
                {
                    guid: this.public.guid,
                    userPublic: this.public
                },
                this
            );
        });

        // ----------------------------------------------------
        // Send room information
        // ----------------------------------------------------

        this.socket.on("login", () => {

            if (!this.loggedin) {
                return;
            }

            this.socket.emit("room", {
                room: this.room.name,
                isOwner: false,
                isPublic: this.room.name === "default"
            });
        });

        // ----------------------------------------------------
        // Talk
        // ----------------------------------------------------

        this.socket.on("talk", (msg) => {

            if (
                typeof msg !== "object" ||
                typeof msg.text !== "string"
            ) {
                return;
            }

            // Sanitize HTML.
            if (this.sanitize) {
                msg.text = msg.text
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
            }

            // Blacklist filter.
            if (
                filtertext(msg.text) &&
                this.sanitize
            ) {
                msg.text = "RAPED AND ABUSED";
            }

            // Slowmode.
            if (this.slowed) {
                return;
            }

            this.room.emit("talk", {
                guid: this.public.guid,
                text: msg.text
            });

            this.slowed = true;

            setTimeout(() => {
                this.slowed = false;
            }, config.slowmode);
        });

        // ----------------------------------------------------
        // Disconnect
        // ----------------------------------------------------

        this.socket.on("disconnect", () => {

            const ip =
                this.socket.request.connection.remoteAddress;

            if (userips[ip] !== undefined) {
                userips[ip]--;

                if (userips[ip] <= 0) {
                    delete userips[ip];
                }
            }

            if (!this.loggedin) {
                return;
            }

            // Remove public user information.
            delete this.room.usersPublic[
                this.public.guid
            ];

            // Tell everyone that the user left.
            this.room.emit("leave", {
                guid: this.public.guid
            });

            // Remove user from room.
            const index =
                this.room.users.indexOf(this);

            if (index !== -1) {
                this.room.users.splice(index, 1);
            }
        });

        // ----------------------------------------------------
        // Command handler
        // ----------------------------------------------------

        this.socket.on("command", (cmd) => {

            if (
                !cmd ||
                !Array.isArray(cmd.list) ||
                cmd.list[0] === undefined
            ) {
                return;
            }

            const comd = cmd.list[0];

            let param = "";

            if (cmd.list[1] === undefined) {
                param = "";
            } else {
                param = cmd.list
                    .slice(1)
                    .join(" ");
            }

            // Validate parameter.
            if (typeof param !== "string") {
                return;
            }

            // Sanitize parameter.
            if (this.sanitize) {
                param = param
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
            }

            // Blacklist filter.
            if (
                filtertext(param) &&
                this.sanitize
            ) {
                return;
            }

            // Slowmode.
            if (this.slowed) {
                return;
            }

            // Execute command.
            if (commands[comd] !== undefined) {
                commands[comd](this, param);
            }

            this.slowed = true;

            setTimeout(() => {
                this.slowed = false;
            }, config.slowmode);
        });
    }
}

// ============================================================
// Room class
// ============================================================

class room {

    constructor(name) {

        // Room properties.
        this.name = name;
        this.users = [];
        this.usersPublic = {};
    }

    // Send an event to every room member except sender.
    emit(event, msg, sender) {

        this.users.forEach((user) => {

            if (user !== sender) {
                user.socket.emit(event, msg);
            }

        });
    }
}

// ============================================================
// Blacklist checker
// ============================================================

function filtertext(tofilter) {

    let filtered = false;

    blacklist.forEach((listitem) => {

        if (tofilter.includes(listitem)) {
            filtered = true;
        }

    });

    return filtered;
}

