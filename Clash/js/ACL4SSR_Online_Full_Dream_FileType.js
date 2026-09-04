// 随机延迟
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function jitterDelay(min = 200, max = 500) {
    await sleep(randInt(min, max));
}

// 判断 HTML
function looksLikeHtml(text) {
    if (!text) return false;
    const t = text.trim().toLowerCase();
    if (t.startsWith("<!doctype html") || t.startsWith("<html") || t.includes("<head") || t.includes("<body")) return true;
    if (t.includes("</html>")) return true;
    return false;
}

// 带超时和重试的规则下载
async function fetchWithRetry(url, maxAttempts = 3, timeoutMs = 12000) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                cache: "no-store",
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText || ""}`.trim());
            }

            const text = await response.text();

            if (!text || !text.trim()) {
                throw new Error("响应内容为空");
            }

            if (looksLikeHtml(text)) {
                throw new Error("返回了 HTML，可能是拦截页或错误页");
            }

            return text;
        } catch (error) {
            if (error?.name === "AbortError") {
                lastError = new Error(`请求超时：${timeoutMs}ms`);
            } else {
                lastError = error instanceof Error
                    ? error
                    : new Error(String(error));
            }

            console.log(
                `规则下载失败 [${attempt}/${maxAttempts}]：${url}`,
                lastError.message
            );

            if (attempt < maxAttempts) {
                // 约 1 秒、2 秒递增，并加入少量随机抖动
                const backoffMs =
                    Math.min(1000 * (2 ** (attempt - 1)), 4000) +
                    randInt(100, 500);

                await sleep(backoffMs);
            }
        } finally {
            clearTimeout(timer);
        }
    }

    throw new Error(
        `规则下载最终失败：${url}；原因：${lastError?.message || "未知错误"}`
    );
}



async function main(config) {

    //config["disable-keep-alive"] = false;
    //config["keep-alive-idle"] = 60;
    //config["keep-alive-interval"] = 45;
    config["tcp-concurrent"] = true;


    config.sniffer = {
        sniff: {
            TLS: {
                ports: [443, 8443],
            },
            HTTP: {
                ports: [80, 8080, 8880],
            }
            /*,
            QUIC: {
                ports: [443, 8443],
            },*/
        },
        "override-destination": false,
        enable: false,
        "parse-pure-ip": false,
        "force-dns-mapping": true,
        "skip-domain": [
            "Mijia Cloud",
            "dlg.io.mi.com",
            "+.push.apple.com",
            "+.lan",
            "+.local",
            "+.home",
            "+.arpa",
            "localhost",
            "time.*.com",
            "ntp.*.com",
            "stun.*.*",
            "stun.*",
            "+.market.xiaomi.com",
            "localhost.ptlogin2.qq.com",
            "+.msftncsi.com",
            "www.msftconnecttest.com",
            "mtalk.google.com",
            "mtalk4.google.com",
            "mtalk-staging.google.com",
            "mtalk-dev.google.com",
            "alt1-mtalk.google.com",
            "alt1-mtalk.google.com",
            "alt2-mtalk.google.com",
            "alt3-mtalk.google.com",
            "alt4-mtalk.google.com",
            "alt5-mtalk.google.com",
            "alt6-mtalk.google.com",
            "alt7-mtalk.google.com",
            "alt8-mtalk.google.com"
        ],
        "skip-dst-address": [
            "0.0.0.0/8",
            "10.0.0.0/8",
            "100.64.0.0/10",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "224.0.0.0/4",
            "240.0.0.0/4",
        ],

        "skip-src-address": [
            "0.0.0.0/8",
            "10.0.0.0/8",
            "100.64.0.0/10",
            "127.0.0.0/8",
            "169.254.0.0/16",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "224.0.0.0/4",
            "240.0.0.0/4",
        ],
    };

    config.tun = {
        enable: true,
        stack: "system",
        "strict-route": false,
        "auto-route": true,
        "dns-hijack": [
            "any:53"
        ],
        mtu: 1500,
        "disable-icmp-forwarding": true,
        device: "Mihomo",
        "auto-detect-interface": true
    }

    const proxyServerNameserver = config.dns?.["proxy-server-nameserver"] ?? [
        "https://doh.pub/dns-query",
        //"https://223.5.5.5/dns-query",
        "https://dns.alidns.com/dns-query"
    ];

    // 原配置存在 proxy-server-nameserver-policy 就原样保留
    const proxyServerNameserverPolicy = config.dns?.["proxy-server-nameserver-policy"];

    config.dns = {
        enable: true,
        ipv6: false,
        "prefer-h3": false,
        "use-hosts": true,
        "use-system-hosts": true,
        "respect-rules": true,
        "enhanced-mode": "fake-ip",
        "fake-ip-range": "198.18.0.1/16",
        rebind: false,
        "default-nameserver": [
            "119.29.29.29",
            "223.5.5.5"
        ],
        "nameserver": [
            "119.29.29.29",
            "223.5.5.5",
            "https://doh.pub/dns-query",
            //"https://223.5.5.5/dns-query",
            "https://dns.alidns.com/dns-query"
            /*"https://cloudflare-dns.com/dns-query",
            "https://public.dns.iij.jp/dns-query",
            "https://dns.google/dns-query"*/
        ],
        /*"direct-nameserver": [
            "223.5.5.5",
            "119.29.29.29"
        ],*/
        /*"fallback": [
            "https://dns.cloudflare.com/dns-query",
            "https://public.dns.iij.jp/dns-query",
            "https://dns.google/dns-query"
        ],*/
        "proxy-server-nameserver": proxyServerNameserver,

        ...(proxyServerNameserverPolicy !== undefined ? { "proxy-server-nameserver-policy": proxyServerNameserverPolicy } : {}),

        /*"fallback-filter": {
            "domain": [
                "+.google.com",
                "+.facebook.com",
                "+.youtube.com"
            ],
            "geoip": true,
            "geoip-code": "CN",
            "ipcidr": [
                "240.0.0.0/4",
                "0.0.0.0/32"
            ]
        },*/
        "nameserver-policy": {
            "geosite:cn": [
                "119.29.29.29",
                "223.5.5.5",
                "https://doh.pub/dns-query",
                "https://dns.alidns.com/dns-query"
            ],
            "geosite:geolocation-!cn": [
                "https://cloudflare-dns.com/dns-query",
                "https://dns10.quad9.net/dns-query",
                "https://dns.google/dns-query"
            ],

            /*"geosite:gfw": [
                "https://cloudflare-dns.com/dns-query",
                "https://dns.google/dns-query"
            ],*/
            /*"geosite:cn,private": [
                "system",
                "https://doh.pub/dns-query",
                "https://dns.alidns.com/dns-query"
            ],
            "geoip:cn,private": [
                "system",
                "https://doh.pub/dns-query",
                "https://dns.alidns.com/dns-query"
            ],
            "rule-set:MyDirect": [
                "system",
                "https://doh.pub/dns-query",
                "https://dns.alidns.com/dns-query"
            ],*/
        },
        "fake-ip-filter": [
            "geosite:connectivity-check",
            "geosite:private",
            //"geosite:cn",
                
            // LAN
            "*.lan",
            "*.localdomain",
            "*.example",
            "*.invalid",
            "*.localhost",
            "*.test",
            "*.local",
            "*.home.arpa",
            "*.direct",
            "cable.auth.com",
            "network-test.debian.org",
            "detectportal.firefox.com",
            "resolver1.opendns.com",
            "global.turn.twilio.com",
            "global.stun.twilio.com",
            "app.yinxiang.com",
            "injections.adguard.org",
            "localhost.*.weixin.qq.com",
            "*.blzstatic.cn",
            "*.cmpassport.com",
            "id6.me",
            "open.e.189.cn",
            "opencloud.wostore.cn",
            "id.mail.wo.cn",
            "mdn.open.wo.cn",
            "hmrz.wo.cn",
            "nishub1.10010.com",
            "enrichgw.10010.com",
            "*.wosms.cn",
            "*.jegotrip.com.cn",
            "*.icitymobile.mobi",
            "*.pingan.com.cn",
            "*.cmbchina.com",
            "*.10099.com.cn",
            "*.microdone.cn",
            "PDC._msDCS.*.*",
            "DC._msDCS.*.*",
            "GC._msDCS.*.*",
                
            // 放行NTP服务
            "time.*.com",
            "time.*.gov",
            "time.*.edu.cn",
            "time.*.apple.com",
            "time-ios.apple.com",
            "time1.*.com",
            "time2.*.com",
            "time3.*.com",
            "time4.*.com",
            "time5.*.com",
            "time6.*.com",
            "time7.*.com",
            "ntp.*.com",
            "ntp1.*.com",
            "ntp2.*.com",
            "ntp3.*.com",
            "ntp4.*.com",
            "ntp5.*.com",
            "ntp6.*.com",
            "ntp7.*.com",
            "*.time.edu.cn",
            "*.ntp.org.cn",
            "+.pool.ntp.org",
            "time1.cloud.tencent.com",
                
            // 放行网易云音乐
            "music.163.com",
            "*.music.163.com",
            "*.126.net",
                
            // 百度音乐
            "musicapi.taihe.com",
            "music.taihe.com",
                
            // 酷狗音乐
            "songsearch.kugou.com",
            "trackercdn.kugou.com",
                
            // 酷我音乐
            "*.kuwo.cn",
                
            // JOOX音乐
            "api-jooxtt.sanook.com",
            "api.joox.com",
            "joox.com",
                
            // QQ音乐
            "y.qq.com",
            "*.y.qq.com",
            "streamoc.music.tc.qq.com",
            "mobileoc.music.tc.qq.com",
            "isure.stream.qqmusic.qq.com",
            "dl.stream.qqmusic.qq.com",
            "aqqmusic.tc.qq.com",
            "amobile.music.tc.qq.com",
                
            // 虾米音乐
            "*.xiami.com",
                
            // 咪咕音乐
            "*.music.migu.cn",
            "music.migu.cn",
                
            // Win10 本地连接检测
            "+.msftconnecttest.com",
            "+.msftncsi.com",
                
            // QQ登录
            "localhost.ptlogin2.qq.com",
            "localhost.sec.qq.com",
            "+.qq.com",
            "+.tencent.com",
                
            // Nintendo Switch
            "+.srv.nintendo.net",
            "*.n.n.srv.nintendo.net",
            "+.cdn.nintendo.net",
                
            // Sony PlayStation
            "+.stun.playstation.net",
                
            // Microsoft Xbox
            "xbox.*.*.microsoft.com",
            "*.*.xboxlive.com",
            "xbox.*.microsoft.com",
            "xnotify.xboxlive.com",
                
            // Wotgame
            "+.battle.net",
            "+.battlenet.com.cn",
            "+.wotgame.cn",
            "+.wggames.cn",
            "+.wowsgame.cn",
            "+.wargaming.net",
                
            // Golang
            "proxy.golang.org",
                
            // STUN
            "stun.*.*",
            "stun.*.*.*",
            "+.stun.*.*",
            "+.stun.*.*.*",
            "+.stun.*.*.*.*",
            "+.stun.*.*.*.*.*",
                
            // Linksys Router
            "heartbeat.belkin.com",
            "*.linksys.com",
            "*.linksyssmartwifi.com",
                
            // ASUS Router
            "*.router.asus.com",
                
            // Apple Software Update Service
            "mesu.apple.com",
            "swscan.apple.com",
            "swquery.apple.com",
            "swdownload.apple.com",
            "swcdn.apple.com",
            "swdist.apple.com",
                
            // Google
            "lens.l.google.com",
            "stun.l.google.com",
            "na.b.g-tun.com",
                
            // Google Android / FCM
            "mtalk.google.com",
            "mtalk4.google.com",
            "mtalk-staging.google.com",
            "mtalk-dev.google.com",
            "alt1-mtalk.google.com",
            "alt2-mtalk.google.com",
            "alt3-mtalk.google.com",
            "alt4-mtalk.google.com",
            "alt5-mtalk.google.com",
            "alt6-mtalk.google.com",
            "alt7-mtalk.google.com",
            "alt8-mtalk.google.com",
            "android.apis.google.com",
            "device-provisioning.googleapis.com",
            "firebaseinstallations.googleapis.com",
                
            // Netflix
            "+.nflxvideo.net",
                
            // Final Fantasy XIV
            "*.square-enix.com",
            "*.finalfantasyxiv.com",
            "*.ffxiv.com",
            "*.ff14.sdo.com",
            "ff.dorado.sdo.com",
                
            // Bilibili
            "*.mcdn.bilivideo.cn",
                
            // Disney Plus
            "+.media.dssott.com",
                
            // shark007 Codecs
            "shark007.net",
                
            // Mijia
            "Mijia Cloud",
                
            // 招商银行
            "+.cmbchina.com",
            "+.cmbimg.com",
                
            // AdGuard
            "local.adguard.org",
                
            // 迅雷
            "+.sandai.net",
            "+.n0808.com",
                
            // UU Plugin
            "+.uu.163.com",
            "ps.res.netease.com",
                
            // Wifi Calling
            "+.pub.3gppnetwork.org"
                
            // GEOSITE(Meta core)
            // "geosite:category-games",
            // "geosite:apple-cn",
            // "geosite:google-cn"
        ]

        /*
        "fake-ip-filter": [
            "geosite:connectivity-check",
            "geosite:private",
            //"geosite:cn",
            "+.lan",
            "+.local",
            "+.home",
            "+.arpa",
            "localhost",
            "time.*.com",
            "ntp.*.com",
            "stun.*.*",
            "stun.*",
            "+.market.xiaomi.com",
            "localhost.ptlogin2.qq.com",
            "+.msftncsi.com",
            "www.msftconnecttest.com",
            "mtalk.google.com",
            "mtalk4.google.com",
            "mtalk-staging.google.com",
            "mtalk-dev.google.com",
            "alt1-mtalk.google.com",
            "alt1-mtalk.google.com",
            "alt2-mtalk.google.com",
            "alt3-mtalk.google.com",
            "alt4-mtalk.google.com",
            "alt5-mtalk.google.com",
            "alt6-mtalk.google.com",
            "alt7-mtalk.google.com",
            "alt8-mtalk.google.com",
            "android.apis.google.com",
            "device-provisioning.googleapis.com",
            "firebaseinstallations.googleapis.com"
        ]*/
    };




    // 固定的 proxy-groups（保持你原来的不变）
    const proxyGroups = [
        {
            name: "🚀 节点选择",
            type: "select",
            proxies: [
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "🚀 手动切换1",
            "include-all": true,
            type: "select",
        },
        {
            name: "♻️ 自动选择",
            "include-all": true,
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            interval: 300,
            tolerance: 200,
            lazy: true,
            timeout: 5000,
            "max-failed-times": 3
        },
        {
            name: "🌍 国外媒体",
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "📢 谷歌FCM",
            type: "select",
            proxies: [
                "DIRECT",
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",          
            ],
        },
        {
            name: "Ⓜ️ 微软云盘",
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "Ⓜ️ 微软服务",
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "🍎 苹果服务",
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "🎮 游戏平台",
            "include-all": true,
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "🔑 RemoteSSH",
            "include-all": true,
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },
        {
            name: "🎯 全球直连",
            type: "select",
            proxies: [
                "DIRECT"
            ],
        },
        {
            name: "🐟 漏网之鱼",
            type: "select",
            proxies: [
                "🚀 节点选择",
                "♻️ 自动选择",
                "🚀 手动切换1",
                "🇺🇲 美国自动",
                "🇭🇰 香港自动",
                "🇨🇳 台湾自动",
                "🇸🇬 狮城自动",
                "🇯🇵 日本自动",
                "DIRECT",
            ],
        },

        {
            name: "🇭🇰 香港自动",
            "include-all": true,
            filter: "(?i)香港|港|HK|hk|Hong Kong|HongKong|hongkong",
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            interval: 300,
            tolerance: 150,
            lazy: false,
            timeout: 5000,
            "max-failed-times": 3
        },
        {
            name: "🇨🇳 台湾自动",
            "include-all": true,
            filter: "(?i)台|新北|彰化|TW|Taiwan",
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            interval: 300,
            tolerance: 150,
            lazy: false,
            timeout: 5000,
            "max-failed-times": 3
        },
        {
            name: "🇺🇲 美国自动",
            "include-all": true,
            //filter:"(?i)美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|US|United States|America|California",
            filter: "(?i)(?:美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|(?<![A-Za-z])US(?:(?=\s*x\d)|(?![A-Za-z]))|USA|UnitedStates|United States|America|California)",
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            interval: 300,
            tolerance: 250,
            lazy: false,
            timeout: 5000,
            "max-failed-times": 3
        },
        {
            name: "🇯🇵 日本自动",
            "include-all": true,
            filter: "(?i)日本|川日|东京|大阪|泉日|埼玉|沪日|深日|JP|Japan",
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            interval: 300,
            tolerance: 150,
            lazy: false,
            timeout: 5000,
            "max-failed-times": 3
        },
        {
            name: "🇸🇬 狮城自动",
            "include-all": true,
            filter: "(?i)新加坡|坡|狮城|SG|Singapore",
            type: "url-test",
            url: "https://cp.cloudflare.com/generate_204",
            interval: 300,
            tolerance: 150,
            lazy: false,
            timeout: 5000,
            "max-failed-times": 3
        }
    ];
    // 赋值给 config["proxy-groups"]
    config["proxy-groups"] = proxyGroups;

    // 确保有 rule-providers
    if (!config['rule-providers']) {
        config['rule-providers'] = {};
    }

    // 这里直接用你的原有 rule-providers 定义
    config["rule-providers"] = Object.assign(config["rule-providers"], {
        MyDirect: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/WC-Dream/ACL4SSR/WD/Clash/direct.list",
            path: "./ruleset/MyDirect.txt",
        },
        FCM: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/GoogleFCM.list",
            path: "./ruleset/FCM.txt",
        },
        Onedrive: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/OneDrive.list",
            path: "./ruleset/Onedrive.txt",
        },
        Microsoft: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Microsoft.list",
            path: "./ruleset/Microsoft.txt",
        },
        Epic: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Epic.list",
            path: "./ruleset/Epic.txt",
        },
        Sony: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Sony.list",
            path: "./ruleset/Sony.txt",
        },
        Steam: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Steam.list",
            path: "./ruleset/Steam.txt",
        },
        MySteam: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/WC-Dream/ACL4SSR/WD/Clash/steam.list",
            path: "./ruleset/MySteam.txt",
        },
        GlobalMedia: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyMedia.list",
            path: "./ruleset/GlobalMedia.txt",
        },
        Proxy: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ProxyGFWlist.list",
            path: "./ruleset/Proxy.txt",
        },
        MyProxy: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://raw.githubusercontent.com/WC-Dream/ACL4SSR/WD/Clash/proxy.list",
            path: "./ruleset/MyProxy.txt",
        },
        AI: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://ruleset.skk.moe/Clash/non_ip/ai.txt",
            path: "./ruleset/AI.txt",
        },
        TikTok: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://cdn.jsdmirror.com/gh/powerfullz/override-rules@master/ruleset/TikTok.list",
            path: "./ruleset/TikTok.list",
        },
        GoogleFCM: {
            type: "http",
            behavior: "classical",
            interval: 86400,
            format: "text",
            path: "./ruleset/FirebaseCloudMessaging.list",
            url: "https://cdn.jsdmirror.com/gh/powerfullz/override-rules@master/ruleset/FirebaseCloudMessaging.list",
        },
        SSH: {
            type: "http",
            behavior: "classical",
            interval: 86400,
            format: "text",
            path: "./ruleset/ssh.list",
            url: "https://raw.githubusercontent.com/WC-Dream/ACL4SSR/WD/Clash/ssh.list",
        },
        ChinaIP: {
            type: "http",
            behavior: "classical",
            interval: 86400,
            format: "text",
            path: "./ruleset/ChinaIP.list",
            url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/ChinaIp.list",
        },
        MoeGlobal: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://ruleset.skk.moe/List/non_ip/global.conf",
            path: "./ruleset/MoeGlobal.txt",
        },
        MoeChina: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://ruleset.skk.moe/List/non_ip/domestic.conf",
            path: "./ruleset/MoeChina.txt",
        },
        MoeChinaIP: {
            type: "http",
            behavior: "classical",
            format: "text",
            interval: 86400,
            url: "https://ruleset.skk.moe/List/ip/china_ip.conf",
            path: "./ruleset/MoeChinaIP.txt",
        }
        // SpeedTest: {
        //     type: "http",
        //     behavior: "domain",
        //     format: "text",
        //     interval: 86400,
        //     url: "https://ruleset.skk.moe/Clash/domainset/speedtest.txt",
        //     path: "./ruleset/SpeedTest.list",
        // },
        // ... 这里省略你的全部其他 rule-providers 定义
    });

    const providerToProxyGroup_back = {
        MyDirect: "🎯 全球直连",
        MyProxy: "🚀 节点选择",
        FCM: "📢 谷歌FCM",
        GoogleFCM: "📢 谷歌FCM",
        //SSH: "🔑 RemoteSSH",
        Onedrive: "Ⓜ️ 微软云盘",
        Microsoft: "Ⓜ️ 微软服务",
        Epic: "🎮 游戏平台",
        Sony: "🎮 游戏平台",
        Steam: "🎮 游戏平台",
        MySteam: "🎮 游戏平台",
        AI: "🚀 节点选择",
        SpeedTest: "🚀 节点选择",
        GlobalMedia: "🌍 国外媒体",
        TikTok: "🌍 国外媒体",
        Proxy: "🚀 节点选择",
        MoeGlobal: "🚀 节点选择",
        MoeChina: "🎯 全球直连",
        MoeChinaIP: "🎯 全球直连",
        ChinaIP: "🎯 全球直连",
        // 其他 provider 可以根据需求继续加
    };

    const providerToProxyGroup = [

        { type: "rule", value: "GEOIP,LAN,🎯 全球直连,no-resolve" },
        //{ type: "rule", value: "RULE-SET,MyDirect,🎯 全球直连" },
        { type: "rule", value: "GEOSITE,PRIVATE,🎯 全球直连" },
        { type: "rule", value: "GEOIP,PRIVATE,🎯 全球直连,no-resolve" },

        // 自己的
        { type: "provider", name: "MyDirect", group: "🎯 全球直连" },
        { type: "provider", name: "MyProxy", group: "🚀 节点选择" },

        // 更细的规则
        //{ type: "provider", name: "SSH", group: "🔑 RemoteSSH" },
        { type: "provider", name: "FCM", group: "📢 谷歌FCM" },
        { type: "provider", name: "GoogleFCM", group: "📢 谷歌FCM" },
        { type: "provider", name: "Onedrive", group: "Ⓜ️ 微软云盘" },
        { type: "provider", name: "Microsoft", group: "Ⓜ️ 微软服务" },
        { type: "rule", value: "GEOSITE,APPLE,🍎 苹果服务" },
        { type: "provider", name: "Epic", group: "🎮 游戏平台" },
        { type: "provider", name: "Sony", group: "🎮 游戏平台" },
        { type: "provider", name: "Steam", group: "🎮 游戏平台" },
        { type: "provider", name: "MySteam", group: "🎮 游戏平台" },
        { type: "provider", name: "AI", group: "🚀 节点选择" },
        { type: "provider", name: "TikTok", group: "🌍 国外媒体" },
        { type: "rule", value: "GEOIP,NETFLIX,🌍 国外媒体,no-resolve" },
        { type: "provider", name: "GlobalMedia", group: "🌍 国外媒体" },
        { type: "rule", value: "GEOIP,GOOGLE,🚀 节点选择,no-resolve" },
        { type: "rule", value: "GEOSITE,TELEGRAM,🚀 节点选择" },
        { type: "rule", value: "GEOIP,TELEGRAM,🚀 节点选择,no-resolve" },

        // 大的
        { type: "provider", name: "Proxy", group: "🚀 节点选择" },
        { type: "rule", value: "GEOSITE,gfw,🚀 节点选择" },
        { type: "rule", value: "GEOSITE,CN,🎯 全球直连" },
        { type: "rule", value: "GEOIP,CN,🎯 全球直连,no-resolve" },
        { type: "provider", name: "MoeChina", group: "🎯 全球直连" },
        { type: "provider", name: "MoeChinaIP", group: "🎯 全球直连", noResolve: true },
        { type: "provider", name: "ChinaIP", group: "🎯 全球直连", noResolve: true },

        //兜底
        { type: "rule", value: "MATCH,🐟 漏网之鱼" },

    ];


    // 新的 rules 数组
    config.rules = [];

    for (const item of providerToProxyGroup) {

        // ✅ 1) inline rule：原样 push，不 fetch 不解析
        if (item.type === "rule") {
            config.rules.push(item.value);
            continue;
        }

        // ✅ 2) provider：fetch + 解析 + 自动补代理组
        if (item.type === "provider") {
            const name = item.name;
            const provider = config["rule-providers"][name];
            if (!provider || !provider.url) continue;

            await jitterDelay(200, 500);

            try {
                const text = await fetchWithRetry(
                    provider.url,
                    3,      // 最多尝试3次
                    10000   // 每次最多等待10秒
                );

                const lines = text
                    .split("\n")
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith("#"));

                const proxyGroup = item.group || "🚀 节点选择";
                const forceNoResolve = item.noResolve === true;

                const ruleTypesNeedPolicy = new Set([
                    "DOMAIN",
                    "DOMAIN-SUFFIX",
                    "DOMAIN-KEYWORD",
                    "DOMAIN-REGEX",
                    "IP-CIDR",
                    "IP-CIDR6",
                    "IP-ASN",
                    "GEOIP",
                    "GEOSITE",
                    "SRC-IP-CIDR",
                    "DST-PORT",
                    "SRC-PORT",
                    "PROCESS-NAME",
                    "PROCESS-PATH",
                    "PROCESS-PATH-REGEX",
                ]);

                for (const rawRule of lines) {
                    let rule = rawRule.trim();

                    if (!rule) continue;
                    if (rule.startsWith("#")) continue;
                    if (rule.startsWith("USER-AGENT") || rule.startsWith("URL-REGEX")) continue;
                    if (rule.includes("7h1s_rul35et_i5_mad3_by_5ukk4w-ruleset.skk.moe")) continue;

                    const hasNoResolve = rule.endsWith(",no-resolve");
                    if (hasNoResolve) {
                        rule = rule.slice(0, -",no-resolve".length);
                    }

                    const parts = rule.split(",").map(s => s.trim());
                    const ruleType = parts[0];
                    const needNoResolve = hasNoResolve || forceNoResolve;

                    // 只处理 Mihomo 规则；非规则行跳过
                    if (!ruleTypesNeedPolicy.has(ruleType)) continue;

                    // 如果已经是三段及以上，认为最后一段可能是原策略组，替换成你的 proxyGroup
                    // 例如 DOMAIN-SUFFIX,example.com,DIRECT => DOMAIN-SUFFIX,example.com,🚀 节点选择
                    let baseRule;
                    if (parts.length >= 3) {
                        baseRule = parts.slice(0, -1).join(",");
                    } else {
                        baseRule = parts.join(",");
                    }

                    config.rules.push(
                        `${baseRule},${proxyGroup}${needNoResolve ? ",no-resolve" : ""}`
                    );
                }
            } catch (e) {
                console.log(`获取规则失败(已重试): ${name}`, e);
            }

            continue;
        }
    }



    config["geodata-mode"] = true;
    config["geox-url"] = {
        geoip: "https://cdn.jsdmirror.com/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
        geosite: "https://cdn.jsdmirror.com/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
        mmdb: "https://cdn.jsdmirror.com/gh/Loyalsoldier/geoip@release/Country.mmdb",
        asn: "https://cdn.jsdmirror.com/gh/Loyalsoldier/geoip@release/GeoLite2-ASN.mmdb",
    };

    return config;
}

async function processFileContent(raw) {
    const config = ProxyUtils.yaml.safeLoad(raw);
    if (!config || typeof config !== "object") {
        throw new Error("Invalid Mihomo config content");
    }

    const processed = await main(config);
    return ProxyUtils.yaml.safeDump(processed);
}

function extractText(value) {
    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Uint8Array) {
        return new TextDecoder().decode(value);
    }

    if (value instanceof ArrayBuffer) {
        return new TextDecoder().decode(new Uint8Array(value));
    }

    if (value && typeof value === "object") {
        return extractText(value.content ?? value.body ?? value.data ?? value.value ?? "");
    }

    return "";
}

function readFileInput(content) {
    const direct = extractText(content);
    if (direct.trim()) return direct;

    if (typeof $content !== "undefined") {
        const fromContent = extractText($content);
        if (fromContent.trim()) return fromContent;
    }

    if (typeof $files !== "undefined") {
        const files = Array.isArray($files) ? $files : [$files];
        for (const file of files) {
            const fromFile = extractText(file);
            if (fromFile.trim()) return fromFile;
        }
    }

    throw new Error("No file content found");
}

async function operator(content) {
    const raw = readFileInput(content);
    const output = await processFileContent(raw);
    if (typeof $content !== "undefined") {
        $content = output;
    }
    return output;
}

if (typeof $content !== "undefined" || typeof $files !== "undefined") {
    $content = await operator();
}
