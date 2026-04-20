/**
 * emos 整合脚本 (Egern)
 * 1. 捕获 Token 并发送成功/重复通知 (源自 emos获取参数.js)
 * 2. 自动化签到并展示修仙境界 (源自 emos签到.js)
 */

var key = "emos_best_token";

// ================= 模式 A: 获取参数 (Rewrite 触发) =================
if (typeof $request !== "undefined" && $request) {
    var headers = $request.headers;
    if (headers) {
        var auth = headers["Authorization"] || headers["authorization"];
        if (auth && auth.indexOf("Bearer") !== -1) {
            var newToken = auth.trim();
            try {
                var oldToken = $persistentStore.read(key);
                if (!oldToken || oldToken !== newToken) {
                    $persistentStore.write(newToken, key);
                    // 弹出成功通知
                    $notification.post("emos 签到", "✅ 新 Token 获取成功", "凭证已更新，开始修仙！");
                } else {
                    // 弹出重复通知
                    $notification.post("emos 签到", "ℹ️ 重复 Token 提醒", "凭证一致，无需重复操作。");
                }
            } catch (e) {
                console.log("emos 存储异常: " + e.message);
            }
        }
    }
    $done({});
} 

// ================= 模式 B: 自动化签到 (Cron 触发) =================
else {
    // 修仙境界体系
    var levels = [{ n: "👤凡人期", max: 9 }, { n: "💨练气期·一层", max: 19 }, { n: "💨练气期·二层", max: 29 }, { n: "🏛️筑基期", max: 999 }, { n: "👑真仙期", max: Infinity }];
    function getLv(c) {
        var min = 0;
        for (var i = 0; i < levels.length; i++) {
            if (c <= levels[i].max) {
                var ratio = levels[i].max === Infinity ? 1 : (c - min) / (levels[i].max - min + 1);
                var bar = "■".repeat(Math.floor(ratio * 10)).padEnd(10, "□");
                return { name: levels[i].n, bar: bar, per: (ratio * 100).toFixed(1) };
            }
            min = levels[i].max + 1;
        }
    }

    var savedToken = $persistentStore.read(key);
    if (!savedToken) {
        $notification.post("emos 签到", "❌ 失败", "未找到 Token，请先登录网页触发获取");
        $done();
    } else {
        var headers = { "Authorization": savedToken, "Content-Type": "application/json" };
        $httpClient.get({ url: "https://emos.best/api/user", headers: headers }, function(err, resp, data) {
            if (err) { $done(); return; }
            try {
                var uObj = JSON.parse(data);
                var today = new Date().toISOString().substring(0, 10);
                var isSigned = (uObj.sign && uObj.sign.sign_at && uObj.sign.sign_at.indexOf(today) !== -1);
                
                if (isSigned) {
                    var lv = getLv(uObj.carrot);
                    $notification.post("emos 签到", "✨ 仙途长青", "境界: [" + lv.name + "]\n修为: " + uObj.carrot + " 🥕\n进度: [" + lv.bar + "] " + lv.per + "%");
                    $done();
                } else {
                    $httpClient.put({ url: "https://emos.best/api/user/sign?content=" + encodeURIComponent("滴滴打卡"), headers: headers }, function(sErr, sResp, sData) {
                        var res = JSON.parse(sData);
                        var lvNow = getLv(uObj.carrot + res.earn_point);
                        $notification.post("emos 签到", "✅ 突破成功", "获得: +" + res.earn_point + " 🥕\n当前境界: " + lvNow.name);
                        $done();
                    });
                }
            } catch (e) { $done(); }
        });
    }
}
