```javascript
"use strict";

/*
 * ============================================================
 *  BonziBUDDY Client
 *  Rewritten / cleaned-up version of script.js
 * ============================================================
 */

// ============================================================
// Configuration
// ============================================================

const passcode = "";
let err = false;

const allowed = [
    "red",
    "brown",
    "purple",
    "green",
    "blue",
    "pink"
];

const mapped = {
    jew: "blue",
    allah: "red",
    seamus: "green",
    brown: "orange",
    inverted: "green",
    jabba: "blue",
    ronnie: "brown"
};

function colormap(color) {
    return mapped[color] || "purple";
}


// ============================================================
// Utility functions
// ============================================================

function updateAds() {
    const height = $(window).height() - $(adElement).height();
    const hideAd = height <= 250;
    const contentHeight = hideAd ? $(window).height() : height;

    $(adElement)[hideAd ? "hide" : "show"]();
    $("#content").height(contentHeight);
}

function range(start, end) {
    const result = [];

    if (start <= end) {
        for (let i = start; i <= end; i++) {
            result.push(i);
        }
    } else {
        for (let i = start; i >= end; i--) {
            result.push(i);
        }
    }

    return result;
}

function replaceAll(text, search, replacement) {
    return text.replace(new RegExp(search, "g"), replacement);
}

function s4() {
    return Math.floor(65536 * (1 + Math.random()))
        .toString(16)
        .substring(1);
}

function youtubeParser(url) {
    const pattern =
        /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;

    const match = url.match(pattern);

    if (!match || match[7].length !== 11) {
        return false;
    }

    return match[7];
}

function rtimeOut(callback, delay) {
    let cancelled = false;

    const start = Date.now();

    function tick() {
        if (cancelled) {
            return;
        }

        if (Date.now() - start >= delay) {
            callback();
            return;
        }

        window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);

    return {
        clear() {
            cancelled = true;
        }
    };
}

function rInterval(callback, delay) {
    let cancelled = false;
    let previous = Date.now();

    function tick() {
        if (cancelled) {
            return;
        }

        const now = Date.now();

        if (now - previous >= delay) {
            previous += delay;
            callback();
        }

        window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);

    return {
        clear() {
            cancelled = true;
        }
    };
}

function linkify(text) {
    const urlPattern =
        /(https?:\/\/([-\w.]+)+(:\d+)?(\/([\w/_]*(\?\S+)?)?)?)/gi;

    return text.replace(
        urlPattern,
        "<a href='$1' target='_blank' rel='noopener noreferrer'>$1</a>"
    );
}


// ============================================================
// Asset loading
// ============================================================

function loadBonzis(callback) {
    loadQueue.loadManifest([
        {
            id: "bonziBlack",
            src: "./img/bonzi/black.png"
        },
        {
            id: "bonziBlue",
            src: "./img/bonzi/blue.png"
        },
        {
            id: "bonziBrown",
            src: "./img/bonzi/brown.png"
        },
        {
            id: "bonziGreen",
            src: "./img/bonzi/green.png"
        },
        {
            id: "bonziPurple",
            src: "./img/bonzi/purple.png"
        },
        {
            id: "bonziRed",
            src: "./img/bonzi/red.png"
        },
        {
            id: "bonziPink",
            src: "./img/bonzi/pink.png"
        },
        {
            id: "topjej",
            src: "./img/misc/topjej.png"
        }
    ]);

    loadQueue.on("fileload", (event) => {
        loadDone.push(event.item.id);
    });

    if (callback) {
        loadQueue.on("complete", callback);
    }
}

function loadTest() {
    $("#login_card").hide();
    $("#login_error").hide();
    $("#login_load").show();

    window.loadTestInterval = rInterval(() => {
        try {
            if (!loadDone.equals(loadNeeded)) {
                throw new Error("Not done loading.");
            }

            login();
            loadTestInterval.clear();
        } catch (error) {
            // Assets are still loading.
        }
    }, 100);
}


// ============================================================
// Login
// ============================================================

function login() {
    socket.emit("login", {
        passcode,
        name: $("#login_name").val(),
        room: $("#login_room").val()
    });

    setup();
}

function errorFatal() {
    const banVisible = $("#page_ban").css("display") !== "none";
    const kickVisible = $("#page_kick").css("display") !== "none";

    if (!banVisible && !kickVisible) {
        $("#page_error").show();
    }
}


// ============================================================
// Socket setup
// ============================================================

let setupComplete = false;

function setup() {
    if (setupComplete) {
        return;
    }

    setupComplete = true;

    $("#chat_send").on("click", sendInput);

    $("#chat_message").on("keypress", (event) => {
        if (event.which === 13) {
            sendInput();
        }
    });

    socket.on("room", (data) => {
        $("#room_owner")[data.isOwner ? "show" : "hide"]();
        $("#room_public")[data.isPublic ? "show" : "hide"]();
        $("#room_private")[data.isPublic ? "hide" : "show"]();

        $(".room_id").text(data.room);
    });

    socket.on("updateAll", (data) => {
        $("#page_login").hide();

        usersPublic = data.usersPublic || {};

        usersUpdate();
        BonziHandler.bonzisCheck();
    });

    socket.on("update", (data) => {
        if (!data || !data.userPublic) {
            return;
        }

        if (!allowed.includes(data.userPublic.color)) {
            data.userPublic.color =
                colormap(data.userPublic.color);
        }

        usersPublic[data.guid] = data.userPublic;

        usersUpdate();
        BonziHandler.bonzisCheck();
    });

    socket.on("talk", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.runSingleEvent([
            {
                type: "text",
                text: data.text
            }
        ]);
    });

    socket.on("joke", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.rng = new Math.seedrandom(data.rng);
        bonzi.cancel();
        bonzi.joke();
    });

    socket.on("youtube", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.youtube(data.vid);
    });

    socket.on("fact", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.rng = new Math.seedrandom(data.rng);
        bonzi.cancel();
        bonzi.fact();
    });

    socket.on("backflip", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.backflip(data.swag);
    });

    socket.on("asshole", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.asshole(data.target);
    });

    socket.on("owo", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.owo(data.target);
    });

    socket.on("triggered", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.runSingleEvent(
            bonzi.data.event_list_triggered
        );
    });

    socket.on("linux", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            return;
        }

        bonzi.cancel();
        bonzi.runSingleEvent(
            bonzi.data.event_list_linux
        );
    });

    socket.on("leave", (data) => {
        const bonzi = bonzis[data.guid];

        if (!bonzi) {
            delete usersPublic[data.guid];
            usersUpdate();
            return;
        }

        bonzi.exit(() => {
            bonzi.deconstruct();

            delete bonzis[data.guid];
            delete usersPublic[data.guid];

            usersUpdate();
        });
    });

    // Identify the client implementation to the server.
    socket.emit("client", "CLASSIC");
}


// ============================================================
// User handling
// ============================================================

function usersUpdate() {
    usersKeys = Object.keys(usersPublic);
    usersAmt = usersKeys.length;
}


// ============================================================
// Chat input
// ============================================================

function sendInput() {
    const input = $("#chat_message").val();

    $("#chat_message").val("");

    if (!input || input.length === 0) {
        return;
    }

    const videoId = youtubeParser(input);

    if (videoId) {
        socket.emit("command", {
            list: ["youtube", videoId]
        });

        return;
    }

    if (input.charAt(0) === "/") {
        const command = input
            .substring(1)
            .split(" ")
            .filter(Boolean);

        if (command.length > 0) {
            socket.emit("command", {
                list: command
            });
        }

        return;
    }

    socket.emit("talk", {
        text: input
    });
}


// ============================================================
// Touch support
// ============================================================

function touchHandler(event) {
    const touches = event.changedTouches;

    if (!touches || touches.length === 0) {
        return;
    }

    const touch = touches[0];

    let mouseEvent;

    switch (event.type) {
        case "touchstart":
            mouseEvent = "mousedown";
            break;

        case "touchmove":
            mouseEvent = "mousemove";
            break;

        case "touchend":
            mouseEvent = "mouseup";
            break;

        default:
            return;
    }

    const simulatedEvent =
        document.createEvent("MouseEvent");

    simulatedEvent.initMouseEvent(
        mouseEvent,
        true,
        true,
        window,
        1,
        touch.screenX,
        touch.screenY,
        touch.clientX,
        touch.clientY,
        false,
        false,
        false,
        false,
        0,
        null
    );

    touch.target.dispatchEvent(simulatedEvent);
}


// ============================================================
// Advertisement handling
// ============================================================

const adElement = "#ap_iframe";

$(function () {
    $(window).on("load", updateAds);
    $(window).on("resize", updateAds);

    $("body").on(
        "DOMNodeInserted",
        adElement,
        updateAds
    );

    $("body").on(
        "DOMNodeRemoved",
        adElement,
        updateAds
    );
});


// ============================================================
// Bonzi class
// ============================================================

class Bonzi {

    constructor(id, userPublic) {
        this.userPublic = userPublic || {
            name: "BonziBUDDY",
            color: "purple",
            speed: 175,
            pitch: 50,
            voice: "en-us"
        };

        this.color = this.userPublic.color;
        this.colorPrev = null;

        this.data = window.BonziData;

        this.drag = false;
        this.dragged = false;
        this.drag_start = null;

        this.eventQueue = [];
        this.eventRun = true;
        this.event = null;
        this.willCancel = false;

        this.run = true;
        this.mute = false;

        this.eventTypeToFunc = {
            anim: "updateAnim",
            html: "updateText",
            text: "updateText",
            idle: "updateIdle",
            add_random: "updateRandom"
        };

        this.id = id || s4() + s4();

        this.rng = new Math.seedrandom(
            this.seed || this.id || Math.random()
        );

        this.selContainer = "#content";

        this.$container = $(this.selContainer);

        this.$container.append(`
            <div id="bonzi_${this.id}" class="bonzi">
                <div class="bonzi_name"></div>
                <div class="bonzi_placeholder"></div>

                <div style="display:none" class="bubble">
                    <p class="bubble-content"></p>
                </div>
            </div>
        `);

        this.selElement =
            `#bonzi_${this.id}`;

        this.selDialog =
            `${this.selElement} > .bubble`;

        this.selDialogCont =
            `${this.selElement} > .bubble > p`;

        this.selNametag =
            `${this.selElement} > .bonzi_name`;

        this.selCanvas =
            `${this.selElement} > .bonzi_placeholder`;

        $(this.selCanvas)
            .width(this.data.size.x)
            .height(this.data.size.y);

        this.$element = $(this.selElement);
        this.$canvas = $(this.selCanvas);
        this.$dialog = $(this.selDialog);
        this.$dialogCont = $(this.selDialogCont);
        this.$nametag = $(this.selNametag);

        this.updateName();

        $.data(
            this.$element[0],
            "parent",
            this
        );

        this.updateSprite(true);

        this.generateEvent(
            this.$canvas,
            "mousedown",
            "mousedown"
        );

        this.generateEvent(
            $(window),
            "mousemove",
            "mousemove"
        );

        this.generateEvent(
            $(window),
            "mouseup",
            "mouseup"
        );

        const max = this.maxCoords();

        this.x = max.x * this.rng();
        this.y = max.y * this.rng();

        this.move();

        $.contextMenu({
            selector: this.selCanvas,

            build: () => ({
                items: {
                    cancel: {
                        name: "Cancel",

                        callback: () => {
                            this.cancel();
                        }
                    },

                    asshole: {
                        name: "Call an Asshole",

                        callback: () => {
                            socket.emit("command", {
                                list: [
                                    "asshole",
                                    this.userPublic.name
                                ]
                            });
                        }
                    },

                    owo: {
                        name: "Notice Bulge",

                        callback: () => {
                            socket.emit("command", {
                                list: [
                                    "owo",
                                    this.userPublic.name
                                ]
                            });
                        }
                    }
                }
            }),

            animation: {
                duration: 175,
                show: "fadeIn",
                hide: "fadeOut"
            }
        });

        this.needsUpdate = false;

        this.runSingleEvent([
            {
                type: "anim",
                anim: "surf_intro",
                ticks: 30
            }
        ]);
    }


    generateEvent(element, eventName, handlerName) {
        element[eventName]((event) => {
            this[handlerName](event);
        });
    }


    eventMake(list) {
        return {
            list,
            index: 0,
            timer: 0,

            cur() {
                return this.list[this.index];
            }
        };
    }


    mousedown(event) {
        if (event.which !== 1) {
            return;
        }

        this.drag = true;
        this.dragged = false;

        this.drag_start = {
            x: event.pageX - this.x,
            y: event.pageY - this.y
        };
    }


    mousemove(event) {
        if (!this.drag) {
            return;
        }

        this.move(
            event.pageX - this.drag_start.x,
            event.pageY - this.drag_start.y
        );

        this.dragged = true;
    }


    mouseup() {
        if (!this.dragged && this.drag) {
            this.cancel();
        }

        this.drag = false;
        this.dragged = false;
    }


    move(x, y) {
        if (arguments.length !== 0) {
            this.x = x;
            this.y = y;
        }

        const max = this.maxCoords();

        this.x = Math.min(
            Math.max(0, this.x),
            max.x
        );

        this.y = Math.min(
            Math.max(0, this.y),
            max.y
        );

        this.$element.css({
            marginLeft: this.x,
            marginTop: this.y
        });

        this.sprite.x = this.x;
        this.sprite.y = this.y;

        BonziHandler.needsUpdate = true;

        this.updateDialog();
    }


    runSingleEvent(eventList) {
        if (!this.mute) {
            this.eventQueue.push(
                this.eventMake(eventList)
            );
        }
    }


    clearDialog() {
        this.$dialogCont.html("");
        this.$dialog.hide();
    }


    cancel() {
        this.clearDialog();
        this.stopSpeaking();

        this.eventQueue = [
            this.eventMake([
                {
                    type: "idle"
                }
            ])
        ];
    }


    retry() {
        this.clearDialog();

        if (this.event) {
            this.event.timer = 0;
        }
    }


    stopSpeaking() {
        this.goingToSpeak = false;

        try {
            this.voiceSource.stop();
        } catch (error) {
            // No active voice source.
        }
    }


    cancelQueue() {
        this.willCancel = true;
    }


    updateAnim() {
        if (this.event.timer === 0) {
            this.sprite.gotoAndPlay(
                this.event.cur().anim
            );
        }

        this.event.timer++;

        BonziHandler.needsUpdate = true;

        if (
            this.event.timer >=
            this.event.cur().ticks
        ) {
            this.eventNext();
        }
    }


    updateText() {
        if (this.event.timer === 0) {
            this.$dialog.css("display", "block");

            this.event.timer = 1;

            const event = this.event.cur();

            this.talk(
                event.text,
                event.say,
                true
            );
        }

        if (
            this.$dialog.css("display") ===
            "none"
        ) {
            this.eventNext();
        }
    }


    updateIdle() {
        let isIdle =
            this.sprite.currentAnimation === "idle" &&
            this.event.timer === 0;

        isIdle =
            isIdle ||
            this.data.pass_idle.includes(
                this.sprite.currentAnimation
            );

        if (isIdle) {
            this.eventNext();
            return;
        }

        if (this.event.timer === 0) {
            this.tmp_idle_start =
                this.data.to_idle[
                    this.sprite.currentAnimation
                ];

            this.sprite.gotoAndPlay(
                this.tmp_idle_start
            );

            this.event.timer = 1;
        }

        if (
            this.tmp_idle_start !==
                this.sprite.currentAnimation &&
            this.sprite.currentAnimation === "idle"
        ) {
            this.eventNext();
        }

        BonziHandler.needsUpdate = true;
    }


    updateRandom() {
        const pool = this.event.cur().add;

        const index = Math.floor(
            pool.length * this.rng()
        );

        const event = this.eventMake(
            pool[index]
        );

        this.eventNext();
        this.eventQueue.unshift(event);
    }


    update() {
        if (!this.run) {
            return;
        }

        if (
            this.eventQueue.length !== 0 &&
            this.eventQueue[0].index >=
                this.eventQueue[0].list.length
        ) {
            this.eventQueue.splice(0, 1);
        }

        this.event =
            this.eventQueue[0];

        if (
            this.eventQueue.length !== 0 &&
            this.eventRun
        ) {
            const type =
                this.event.cur().type;

            try {
                this[this.eventTypeToFunc[type]]();
            } catch (error) {
                this.event.index++;
            }
        }

        if (this.willCancel) {
            this.cancel();
            this.willCancel = false;
        }

        if (this.needsUpdate) {
            this.stage.update();
            this.needsUpdate = false;
        }
    }


    eventNext() {
        this.event.timer = 0;
        this.event.index++;
    }


    talk(text, speech, htmlMode = false) {
        text = replaceAll(
            text,
            "{NAME}",
            this.userPublic.name
        );

        text = replaceAll(
            text,
            "{COLOR}",
            this.color
        );

        if (typeof speech !== "undefined") {
            speech = replaceAll(
                speech,
                "{NAME}",
                this.userPublic.name
            );

            speech = replaceAll(
                speech,
                "{COLOR}",
                this.color
            );
        } else {
            speech = text.replace("&gt;", "");
        }

        const linkedText = linkify(text);

        const isGreenText =
            linkedText.substring(0, 4) === "&gt;" ||
            linkedText[0] === ">";

        const method =
            htmlMode ? "html" : "text";

        this.$dialogCont[method](linkedText)
            [
                isGreenText
                    ? "addClass"
                    : "removeClass"
            ]("bubble_greentext")
            .css("display", "block");

        this.stopSpeaking();

        this.goingToSpeak = true;

        speak.play(
            speech,
            {
                pitch: this.userPublic.pitch,
                speed: this.userPublic.speed
            },

            () => {
                this.clearDialog();
            },

            (source) => {
                if (!this.goingToSpeak) {
                    source.stop();
                }

                this.voiceSource = source;
            }
        );
    }


    joke() {
        this.runSingleEvent(
            this.data.event_list_joke
        );
    }


    fact() {
        this.runSingleEvent(
            this.data.event_list_fact
        );
    }


    exit(callback) {
        this.runSingleEvent([
            {
                type: "anim",
                anim: "surf_away",
                ticks: 30
            }
        ]);

        setTimeout(callback, 2000);
    }


    deconstruct() {
        this.stopSpeaking();

        BonziHandler.stage.removeChild(
            this.sprite
        );

        this.run = false;

        this.$element.remove();
    }


    updateName() {
        this.$nametag.text(
            this.userPublic.name
        );
    }


    youtube(videoId) {
        if (this.mute) {
            return;
        }

        // Only accept a YouTube video ID.
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return;
        }

        this.$dialogCont.html(`
            <iframe
                type="text/html"
                width="173"
                height="173"
                src="https://www.youtube.com/embed/${videoId}?autoplay=1"
                style="width:173px;height:173px"
                frameborder="0"
                allowfullscreen
                loading="lazy">
            </iframe>
        `);

        this.$dialog.show();
    }


    backflip(swag) {
        const events = [
            {
                type: "anim",
                anim: "backflip",
                ticks: 15
            }
        ];

        if (swag) {
            events.push(
                {
                    type: "anim",
                    anim: "cool_fwd",
                    ticks: 30
                },
                {
                    type: "idle"
                }
            );
        }

        this.runSingleEvent(events);
    }


    updateDialog() {
        const max = this.maxCoords();

        if (
            this.data.size.x +
                this.$dialog.width() >
            max.x
        ) {
            if (
                this.y <
                this.$container.height() / 2 -
                    this.data.size.x / 2
            ) {
                this.$dialog
                    .removeClass(
                        "bubble-top bubble-left bubble-right"
                    )
                    .addClass("bubble-bottom");
            } else {
                this.$dialog
                    .removeClass(
                        "bubble-bottom bubble-left bubble-right"
                    )
                    .addClass("bubble-top");
            }

            return;
        }

        if (
            this.x <
            this.$container.width() / 2 -
                this.data.size.x / 2
        ) {
            this.$dialog
                .removeClass(
                    "bubble-left bubble-top bubble-bottom"
                )
                .addClass("bubble-right");
        } else {
            this.$dialog
                .removeClass(
                    "bubble-right bubble-top bubble-bottom"
                )
                .addClass("bubble-left");
        }
    }


    maxCoords() {
        return {
            x:
                this.$container.width() -
                this.data.size.x,

            y:
                this.$container.height() -
                this.data.size.y -
                $("#chat_bar").height()
        };
    }


    asshole(name) {
        this.runSingleEvent([
            {
                type: "text",
                text: `Hey, ${name}!`
            },
            {
                type: "text",
                text: "You are being called out!"
            },
            {
                type: "anim",
                anim: "grin_fwd",
                ticks: 15
            },
            {
                type: "idle"
            }
        ]);
    }


    owo(name) {
        this.runSingleEvent([
            {
                type: "text",
                text: `*notices ${name}'s BonziBulge™*`,
                say: `notices ${name}'s BonziBulge`
            },
            {
                type: "text",
                text: "owo, what is this?",
                say: "oh wow, what is this?"
            }
        ]);
    }


    updateSprite(firstLoad = false) {
        const stage = BonziHandler.stage;

        if (!allowed.includes(this.color)) {
            this.color = colormap(this.color);
        }

        this.cancel();

        if (this.sprite) {
            stage.removeChild(this.sprite);
        }

        if (this.colorPrev !== this.color) {
            delete this.sprite;

            this.sprite = new createjs.Sprite(
                BonziHandler.spriteSheets[this.color],
                firstLoad ? "gone" : "idle"
            );
        }

        this.colorPrev = this.color;

        stage.addChild(this.sprite);

        this.move();
    }
}


// ============================================================
// Bonzi animation data
// ============================================================

const BonziData = {

    size: {
        x: 200,
        y: 160
    },

    sprite: {

        frames: {
            width: 200,
            height: 160
        },

        animations: {

            idle: 0,

            surf_across_fwd:
                [1, 8, "surf_across_still", 1],

            surf_across_still: 9,

            surf_across_back: {
                frames: range(8, 1),
                next: "idle",
                speed: 1
            },

            clap_fwd:
                [10, 12, "clap_still", 1],

            clap_still:
                [13, 15, "clap_still", 1],

            clap_back: {
                frames: range(12, 10),
                next: "idle",
                speed: 1
            },

            surf_intro:
                [277, 302, "idle", 1],

            surf_away:
                [16, 38, "gone", 1],

            gone: 39,

            shrug_fwd:
                [40, 50, "shrug_still", 1],

            shrug_still: 50,

            shrug_back: {
                frames: range(50, 40),
                next: "idle",
                speed: 1
            },

            earth_fwd:
                [51, 57, "earth_still", 1],

            earth_still:
                [58, 80, "earth_still", 1],

            earth_back:
                [81, 86, "idle", 1],

            look_down_fwd:
                [87, 90, "look_down_still", 1],

            look_down_still: 91,

            look_down_back: {
                frames: range(90, 87),
                next: "idle",
                speed: 1
            },

            lean_left_fwd:
                [94, 97, "lean_left_still", 1],

            lean_left_still: 98,

            lean_left_back: {
                frames: range(97, 94),
                next: "idle",
                speed: 1
            },

            beat_fwd:
                [101, 103, "beat_still", 1],

            beat_still:
                [104, 107, "beat_still", 1],

            beat_back: {
                frames: range(103, 101),
                next: "idle",
                speed: 1
            },

            cool_fwd:
                [108, 124, "cool_still", 1],

            cool_still: 125,

            cool_back: {
                frames: range(124, 108),
                next: "idle",
                speed: 1
            },

            cool_right_fwd:
                [126, 128, "cool_right_still", 1],

            cool_right_still: 129,

            cool_right_back: {
                frames: range(128, 126),
                next: "idle",
                speed: 1
            },

            cool_left_fwd:
                [131, 133, "cool_left_still", 1],

            cool_left_still: 134,

            cool_left_back: {
                frames: range(133, 131),
                next: "cool_still",
                speed: 1
            },

            cool_adjust: {
                frames: [
                    124, 123, 122, 121, 120,
                    135, 136, 135, 120,
                    121, 122, 123, 124
                ],
                next: "cool_still",
                speed: 1
            },

            present_fwd:
                [137, 141, "present_still", 1],

            present_still: 142,

            present_back: {
                frames: range(141, 137),
                next: "idle",
                speed: 1
            },

            look_left_fwd:
                [143, 145, "look_left_still", 1],

            look_left_still: 146,

            look_left_back: {
                frames: range(145, 143),
                next: "idle",
                speed: 1
            },

            look_right_fwd:
                [149, 151, "look_right_still", 1],

            look_right_still: 152,

            look_right_back: {
                frames: range(151, 149),
                next: "idle",
                speed: 1
            },

            lean_right_fwd: {
                frames: range(158, 156),
                next: "lean_right_still",
                speed: 1
            },

            lean_right_still: 155,

            lean_right_back:
                [156, 158, "idle", 1],

            praise_fwd:
                [159, 163, "praise_still", 1],

            praise_still: 164,

            praise_back: {
                frames: range(163, 159),
                next: "idle",
                speed: 1
            },

            grin_fwd:
                [182, 189, "grin_still", 1],

            grin_still: 184,

            grin_back: {
                frames: range(184, 182),
                next: "idle",
                speed: 1
            },

            backflip:
                [331, 343, "idle", 1]
        }
    },


    to_idle: {

        surf_across_fwd: "surf_across_back",
        surf_across_still: "surf_across_back",

        clap_fwd: "clap_back",
        clap_still: "clap_back",

        shrug_fwd: "shrug_back",
        shrug_still: "shrug_back",

        earth_fwd: "earth_back",
        earth_still: "earth_back",

        look_down_fwd: "look_down_back",
        look_down_still: "look_down_back",

        lean_left_fwd: "lean_left_back",
        lean_left_still: "lean_left_back",

        beat_fwd: "beat_back",
        beat_still: "beat_back",

        cool_fwd: "cool_back",
        cool_still: "cool_back",
        cool_adjust: "cool_back",

        cool_left_fwd: "cool_left_back",
        cool_left_still: "cool_left_back",

        present_fwd: "present_back",
        present_still: "present_back",

        look_left_fwd: "look_left_back",
        look_left_still: "look_left_back",

        look_right_fwd: "look_right_back",
        look_right_still: "look_right_back",

        lean_right_fwd: "lean_right_back",
        lean_right_still: "lean_right_back",

        praise_fwd: "praise_back",
        praise_still: "praise_back",

        grin_fwd: "grin_back",
        grin_still: "grin_back",

        backflip: "idle",
        idle: "idle"
    },


    pass_idle: [
        "gone"
    ],


    // Safe replacement dialogue pools.
    event_list_joke_open: [
        [
            {
                type: "text",
                text: "{NAME} wants me to tell a joke."
            },
            {
                type: "anim",
                anim: "praise_fwd",
                ticks: 15
            },
            {
                type: "text",
                text: "Okay, okay! Here comes a joke."
            },
            {
                type: "anim",
                anim: "praise_back",
                ticks: 15
            }
        ],

        [
            {
                type: "text",
                text: "{NAME} used /joke!"
            }
        ],

        [
            {
                type: "text",
                text: "HEY EVERYONE! IT'S JOKE TIME!"
            }
        ],

        [
            {
                type: "text",
                text: "Wanna hear a joke?"
            },
            {
                type: "text",
                text: "Here it comes!"
            }
        ]
    ],


    event_list_joke_mid: [
        [
            {
                type: "text",
                text: "What is easy to get into, but hard to get out of?"
            },
            {
                type: "text",
                text: "Trouble!"
            }
        ],

        [
            {
                type: "text",
                text: "Why do programmers prefer dark mode?"
            },
            {
                type: "text",
                text: "Because light attracts bugs!"
            }
        ],

        [
            {
                type: "text",
                text: "Why did the computer go to the doctor?"
            },
            {
                type: "text",
                text: "It had a virus!"
            }
        ],

        [
            {
                type: "text",
                text: "What does a computer eat for a snack?"
            },
            {
                type: "text",
                text: "Microchips!"
            }
        ],

        [
            {
                type: "text",
                text: "Why did the web developer go broke?"
            },
            {
                type: "text",
                text: "They used up all their cache."
            }
        ]
    ],


    event_list_joke_end: [
        [
            {
                type: "text",
                text: "I hope you enjoyed that, {NAME}!"
            }
        ],

        [
            {
                type: "text",
                text: "Was that funny?"
            },
            {
                type: "text",
                text: "Please respond!"
            }
        ],

        [
            {
                type: "text",
                text: "Maybe I should keep practicing my jokes."
            }
        ]
    ],


    event_list_fact_open: [
        [
            {
                type: "html",
                text: "Hey kids, it's time for a Fun Fact&reg;!",
                say: "Hey kids, it's time for a Fun Fact!"
            }
        ]
    ],


    event_list_fact_mid: [
        [
            {
                type: "anim",
                anim: "earth_fwd",
                ticks: 15
            },
            {
                type: "text",
                text:
                    "Did you know that Uranus is 31,518 miles (50,724 km) in diameter?"
            },
            {
                type: "anim",
                anim: "earth_back",
                ticks: 15
            },
            {
                type: "anim",
                anim: "grin_fwd",
                ticks: 15
            }
        ],

        [
            {
                type: "text",
                text:
                    "Fun Fact: This site uses animated sprites for Bonzi."
            }
        ]
    ],


    event_list_fact_end: [
        [
            {
                type: "text",
                text:
                    "Gee whiz, wasn't that interesting?"
            }
        ]
    ],


    event_list_triggered: [
        {
            type: "anim",
            anim: "cool_fwd",
            ticks: 30
        },

        {
            type: "text",
            text:
                "BONZI MODE ACTIVATED!"
        },

        {
            type: "text",
            text:
                "Welcome to the Bonzi experience."
        },

        {
            type: "text",
            text:
                "Everything is operating normally."
        },

        {
            type: "text",
            text:
                "Thanks for being here!"
        },

        {
            type: "idle"
        }
    ],


    event_list_linux: [
        {
            type: "text",
            text:
                "I'd just like to interject for a moment. What you're referring to as Linux is actually the Linux kernel."
        },

        {
            type: "text",
            text:
                "Linux is one component of a complete operating system."
        },

        {
            type: "text",
            text:
                "Many computer users run Linux-based systems every day."
        },

        {
            type: "text",
            text:
                "The kernel manages hardware resources and provides services to applications."
        },

        {
            type: "text",
            text:
                "Linux distributions combine the kernel with many other system components."
        }
    ]
};


// ============================================================
// Build composite event lists
// ============================================================

BonziData.event_list_joke = [
    {
        type: "add_random",
        pool: "event_list_joke_open",
        add: BonziData.event_list_joke_open
    },

    {
        type: "anim",
        anim: "shrug_fwd",
        ticks: 15
    },

    {
        type: "add_random",
        pool: "event_list_joke_mid",
        add: BonziData.event_list_joke_mid
    },

    {
        type: "idle"
    },

    {
        type: "add_random",
        pool: "event_list_joke_end",
        add: BonziData.event_list_joke_end
    },

    {
        type: "idle"
    }
];


BonziData.event_list_fact = [
    {
        type: "add_random",
        pool: "event_list_fact_open",
        add: BonziData.event_list_fact_open
    },

    {
        type: "add_random",
        pool: "event_list_fact_mid",
        add: BonziData.event_list_fact_mid
    },

    {
        type: "idle"
    },

    {
        type: "add_random",
        pool: "event_list_fact_end",
        add: BonziData.event_list_fact_end
    },

    {
        type: "idle"
    }
];


// ============================================================
// Bonzi Handler
// ============================================================

$(document).ready(function () {

    window.BonziHandler = {

        framerate: 1 / 15,

        spriteSheets: {},

        prepSprites() {
            const colors = [
                "black",
                "blue",
                "brown",
                "green",
                "purple",
                "red",
                "pink",
                "pope"
            ];

            colors.forEach((color) => {
                this.spriteSheets[color] =
                    new createjs.SpriteSheet({
                        images: [
                            `./img/bonzi/${color}.png`
                        ],

                        frames:
                            BonziData.sprite.frames,

                        animations:
                            BonziData.sprite.animations
                    });
            });
        },


        resizeCanvas() {
            const width = this.$canvas.width();
            const height = this.$canvas.height();

            this.$canvas.attr({
                width,
                height
            });

            this.stage.updateViewport(
                width,
                height
            );

            this.needsUpdate = true;

            for (let i = 0; i < usersAmt; i++) {
                const id = usersKeys[i];

                if (bonzis[id]) {
                    bonzis[id].move();
                }
            }
        },


        resize() {
            setTimeout(
                this.resizeCanvas.bind(this),
                1
            );
        },


        bonzisCheck() {
            for (let i = 0; i < usersAmt; i++) {
                const id = usersKeys[i];

                if (id in bonzis) {
                    const bonzi = bonzis[id];

                    bonzi.userPublic =
                        usersPublic[id];

                    bonzi.updateName();

                    const color =
                        usersPublic[id].color;

                    if (bonzi.color !== color) {
                        bonzi.color = color;
                        bonzi.updateSprite();
                    }
                } else {
                    bonzis[id] =
                        new Bonzi(
                            id,
                            usersPublic[id]
                        );
                }
            }
        },


        tileBonzis() {
            const width = $(window).width();
            const height = $(window).height();

            let offsetY = 0;
            let spacingY = 80;

            let x = 0;
            let y = 0;

            for (let i = 0; i < usersAmt; i++) {
                const id = usersKeys[i];

                if (!bonzis[id]) {
                    continue;
                }

                bonzis[id].move(x, y);

                x += 200;

                if (x + 100 > width) {
                    x = 0;
                    y += 160;

                    if (y + 160 > height) {
                        offsetY += spacingY;
                        spacingY /= 2;
                        y = offsetY;
                    }
                }
            }
        }
    };


    BonziHandler.prepSprites();

    BonziHandler.$canvas =
        $("#bonzi_canvas");

    BonziHandler.stage =
        new createjs.StageGL(
            BonziHandler.$canvas[0],
            {
                transparent: true
            }
        );

    BonziHandler.stage.tickOnUpdate = false;

    BonziHandler.resizeCanvas();

    BonziHandler.needsUpdate = true;


    BonziHandler.intervalHelper =
        setInterval(() => {
            BonziHandler.needsUpdate = true;
        }, 1000);


    BonziHandler.intervalTick =
        setInterval(() => {

            for (let i = 0; i < usersAmt; i++) {
                const id = usersKeys[i];

                if (bonzis[id]) {
                    bonzis[id].update();
                }
            }

            BonziHandler.stage.tick();

        }, 1000 * BonziHandler.framerate);


    BonziHandler.intervalMain =
        setInterval(() => {

            if (BonziHandler.needsUpdate) {
                BonziHandler.stage.update();
                BonziHandler.needsUpdate = false;
            }

        }, 1000 / 60);


    $(window).on(
        "resize",
        BonziHandler.resize.bind(BonziHandler)
    );


    $("#btn_tile").on(
        "click",
        BonziHandler.tileBonzis.bind(BonziHandler)
    );
});


// ============================================================
// Array equality helper
// ============================================================

if (Array.prototype.equals) {
    console.warn(
        "Overriding existing Array.prototype.equals."
    );
}

Array.prototype.equals = function (array) {

    if (!array) {
        return false;
    }

    if (this.length !== array.length) {
        return false;
    }

    for (let i = 0; i < this.length; i++) {

        if (
            this[i] instanceof Array &&
            array[i] instanceof Array
        ) {
            if (!this[i].equals(array[i])) {
                return false;
            }
        } else if (this[i] !== array[i]) {
            return false;
        }
    }

    return true;
};

Object.defineProperty(
    Array.prototype,
    "equals",
    {
        enumerable: false
    }
);


// ============================================================
// Asset loader
// ============================================================

const loadQueue =
    new createjs.LoadQueue();

const loadDone = [];

const loadNeeded = [
    "bonziBlack",
    "bonziBlue",
    "bonziBrown",
    "bonziGreen",
    "bonziPurple",
    "bonziRed",
    "bonziPink",
    "topjej"
];


// ============================================================
// Application state
// ============================================================

const hostname =
    window.location.hostname;

const socket =
    io("//" + hostname);

let usersPublic = {};
let bonzis = {};

let usersAmt = 0;
let usersKeys = [];

const debug = true;


// ============================================================
// Page initialization
// ============================================================

$(window).on("load", () => {

    $("#login_card").show();
    $("#login_load").hide();

    loadBonzis();
});


$(function () {

    $("#login_go").on(
        "click",
        loadTest
    );


    $("#login_room").val(
        window.location.hash.slice(1)
    );


    $("#login_name, #login_room").on(
        "keypress",
        (event) => {

            if (event.which === 13) {
                login();
            }

        }
    );


    socket.on("ban", (data) => {

        $("#page_ban").show();

        $("#ban_reason")
            .text(data.reason);

        $("#ban_end")
            .text(
                new Date(data.end).toString()
            );
    });


    socket.on("kick", (data) => {

        $("#page_kick").show();

        $("#kick_reason")
            .text(data.reason);
    });


    socket.on("loginFail", (data) => {

        const messages = {
            nameLength: "Name too long.",
            full: "Room is full.",
            nameMal:
                "Invalid room name."
        };

        $("#login_card").show();
        $("#login_load").hide();

        $("#login_error")
            .show()
            .text(
                "Error: " +
                (messages[data.reason] ||
                    "Unknown error.") +
                " (" +
                data.reason +
                ")"
            );
    });


    socket.on("disconnect", () => {
        errorFatal();
    });

});


// ============================================================
// Mobile input compatibility
// ============================================================

$(window).on("load", () => {

    document.addEventListener(
        "touchstart",
        touchHandler,
        true
    );

    document.addEventListener(
        "touchmove",
        touchHandler,
        true
    );

    document.addEventListener(
        "touchend",
        touchHandler,
        true
    );

    document.addEventListener(
        "touchcancel",
        touchHandler,
        true
    );
});
```
