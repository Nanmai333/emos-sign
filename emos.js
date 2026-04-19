/**
 * emos 整合脚本 (Egern 最终修正版)
 * 逻辑：捕获 Token 与 自动签到 逻辑解耦，确保各自通知正常弹出。
 */

var tokenKey = "emos_best_token";

// ================= 1. Token 捕获逻辑 (重写模式触发) =================
if (typeof $request !== "undefined") {
    var auth = $request.headers["Authorization"] || $request.headers["authorization"];
    if (auth && auth.indexOf("Bearer") !== -1) {
        var newToken = auth.trim();
        var oldToken = $persistentStore.read(tokenKey); //
        
        if (!oldToken || oldToken !== newToken) {
            $persistentStore.write(newToken, tokenKey); //
            $notification.post("emos 签到", "✅ 新 Token 获取成功", "凭证已更新，开始修仙！"); //
        } else {
            // 如果你觉得烦可以注释掉下面这行
            $notification.post("emos 签到", "ℹ️ 凭证检查", "Token 已是最新，无需更新。"); //
        }
    }
    $done({});
} 

// ================= 2. 自动签到逻辑 (定时任务模式触发) =================
else {
    // 修仙境界数据
    var levels = [
        { n: "👤凡人期", max: 9 }, { n: "💨练气期·一层", max: 19 }, { n: "💨练气期·二层", max: 29 },
        { n: "💨练气期·三层", max: 39 }, { n: "💨练气期·四层", max: 49 }, { n: "💨练气期·五层", max: 59 },
        { n: "💨练气期·六层", max: 69 }, { n: "💨练气期·七层", max: 79 }, { n: "💨练气期·八层", max: 89 },
        { n: "💨练气期·九层", max: 99 }, { n: "🏛️筑基期·初期", max: 149 }, { n: "🏛️筑基期·中期", max: 299 },
        { n: "🏛️筑基期·后期", max: 599 }, { n: "🏛️筑基期·圆满", max: 999 }, { n: "💎结丹期·初期", max: 1999 },
        { n: "💎结丹期·中期", max: 3499 }, { n: "💎结丹期·后期", max: 5999 }, { n: "💎结丹期·圆满", max: 9999 },
        { n: "👶元婴期·初期", max: 19999 }, { n: "👶元婴期·中期", max: 34999 }, { n: "👶元婴期·后期", max: 59999 },
        { n: "👶元婴期·圆满", max: 99999 }, { n: "✨化神期", max: 499999 }, { n: "🌌炼虚期", max: 999999 },
        { n: "🔗合体期", max: 9999999 }, { n: "🌟大乘期", max: 99999999 }, { n: "👑真仙期", max: Infinity }
    ];

    function getCultivationInfo(carrot) {
        var min = 0;
        for (var i = 0; i < levels.length; i++) {
            var max = levels[i].max;
            if (carrot <= max) {
                var nextNeed = max === Infinity ? 0 : max - carrot + 1;
                var currentTotal = max === Infinity ? 1 : max - min + 1;
                var ratio = max === Infinity ? 1 : (carrot - min) / currentTotal;
                var bar = "";
                for (var j = 0; j < 10; j++) { bar += (j < Math.floor(ratio * 10) ? "■" : "□"); }
                return { name: levels[i].n, bar: bar, percent: (ratio * 100).toFixed(1), nextNeed: nextNeed };
            }
            min = max + 1;
        }
        return { name: "未知", bar: "□□□□□□□□□□", percent: "0.0", nextNeed: 0 };
    }

    var savedToken = $persistentStore.read(tokenKey); //
    if (!savedToken) {
        $notification.post("emos 签到", "❌ 失败", "未找到 Token，请先在 App 内刷新页面");
        $done();
    } else {
        // 解析面板文案
        var content = "签到,我要🥕";
        if (typeof $argument !== "undefined" && $argument.comment) content = $argument.comment;
        var pool = content.split(/[,，]/);
        var randTxt = pool[Math.floor(Math.random() * pool.length)].trim();

        var headers = {
            "Authorization": savedToken,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X)"
        };

        // 步骤 1：获取资料
        $httpClient.get({ url: "https://emos.best/api/user", headers: headers }, function(err, resp, data) {
            if (err || resp.status !== 200) {
                $notification.post("emos 签到", "❌ 网络错误", "获取资料失败");
                $done();
                return;
            }
            try {
                var uObj = JSON.parse(data);
                var today = new Date().toISOString().substring(0, 10);
                var isSigned = (uObj.sign && uObj.sign.sign_at && uObj.sign.sign_at.indexOf(today) !== -1);

                if (isSigned) {
                    var lv = getCultivationInfo(uObj.carrot);
                    $notification.post("emos 签到", "✨ 仙途长青", "境界: [" + lv.name + "]\n修为: " + uObj.carrot + " 🥕\n进度: [" + lv.bar + "] " + lv.percent + "%");
                    $done();
                } else {
                    // 步骤 2：签到
                    $httpClient.put({
                        url: "https://emos.best/api/user/sign?content=" + encodeURIComponent(randTxt),
                        headers: headers
                    }, function(sErr, sResp, sData) {
                        if (sResp && sResp.status === 200) {
                            var res = JSON.parse(sData);
                            var lvNow = getCultivationInfo(uObj.carrot + res.earn_point);
                            $notification.post("emos 签到", "✅ 签到成功", "获得: +" + res.earn_point + " 🥕\n当前境界: " + lvNow.name);
                        } else {
                            $notification.post("emos 签到", "⚠️ 签到失败", "请检查凭证是否过期");
                        }
                        $done();
                    });
                }
            } catch (e) { $done(); }
        });
    }
}
