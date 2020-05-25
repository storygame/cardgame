const Base = require("./base.js");
const uuid = require("es6-uuid");
const crypto = require("crypto");
const rp = require('request-promise');
const WeixinSerivce = require("./weixin.js");

let succ = function(datajson) {
  if (datajson == undefined) {
    return {"errno": 0, "errmsg": ""};
  }
  return {"errno": 0, "errmsg": "", "data": datajson};
};
let fail = function(num, msg) {
  if (num == undefined) {
    num = 1009;
  }
  if (msg == undefined) {
    msg = "Undeclared error.";
  }
  return {"errno": num, "errmsg": msg};
};
const consoleSymbol = {
  "yes": "\u001b[0;32;40m[✓]\u001b[0m",
  "no": "\u001b[0;31;40m[✗]\u001b[0m",
  "info": "\u001b[1;34;40m[*]\u001b[0m"
};
const Errors = think.config("Errors");
module.exports = class extends Base {
  async __before() {
    let method = this.method.toLowerCase();
    this.header("Access-Control-Allow-Origin", this.header("origin") || "*");
    this.header("Access-Control-Allow-Headers", "x-requested-with");
    this.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
    this.header("Access-Control-Allow-Credentials", true);
    if (method === "options") {
      this.end();
      return;
    }
  }
  //Http 请求
  //登录
  async loginAction(usr, pwd) {
    let player = this.model("player");
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    console.log(consoleSymbol["info"], postdata, username);
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      //如果以函数调用，则使用函数调用传递的参数
      if (usr == undefined || pwd == undefined) {
        return this.fail(1000, Errors["1000"]);
      } else {
        username = usr;
        const md5 = crypto.createHash("md5");
        password = md5.update(pwd).digest("hex");
      }
    }
    const data = await player.where({username: username, password: password}).select();
    if (data.length == 1) {
      this.session("Login", true);
      console.log("[*] User login: " + username);
      return this.success({"userinfo": data});
    } else {
      return this.fail(1003, Errors["1003"]);
    }
  }
  //向指定地址发送code并获取wx_Openid,来为用户登录
  async wxLoginAction() {
    const code = this.get("code");
    const userInfo = JSON.parse(this.get("userInfo"));
    if (code == undefined || userInfo == undefined) {
      return this.fail(2001, Errors["2001"]);
    }
    const clientIp = this.ctx.ip;
    // 获取openid
    const options = {
      method: 'GET',
      url: 'https://api.weixin.qq.com/sns/jscode2session',
      qs: {
        grant_type: 'authorization_code',
        js_code: code,
        secret: think.config('weixinAppSecret'),
        appid: think.config('weixinAppID')
      }
    };

    let sessionData = await rp(options);
    sessionData = JSON.parse(sessionData);
    if (sessionData["openid"] == undefined) {
      return this.fail(2000, Errors["2000"]);
    }

    // 根据openid查找用户是否已经注册
    let userdata = await this.model('player').where({weixin_openid: sessionData.openid}).select();
    let userId;
    if (userdata.length != 1) {
      // 注册
      console.log(consoleSymbol["info"], " 注册新用户:<" + userInfo.nickName + ">");
      const md5 = crypto.createHash("md5");
      const default_active_role = '{"1":{"id":1,"active":true},"2":{"id":2,"active":false}}';
      userId = await this.model('player').add({
        id: null,
        username: '微信用户' + think.uuid(6),
        password: md5.update(sessionData.openid).digest("hex"),
        time: new Date().getTime(),
        last_login_time: new Date().getTime(),
        last_login_ip: clientIp,
        weixin_openid: sessionData.openid,
        nickname: String(userInfo.nickName),
        avatar: userInfo.avatarUrl || "role1_1_png",
        gender: userInfo.gender || 1,
        checkin: "{\"last_time\":\"1560353724945\",\"times\":0}",
        active_role: default_active_role,
        single_level: "1.0",
        tmp_level: "1.0"
      });
      userdata = await this.model("player").where({weixin_openid: sessionData.openid}).select();
    } else {
      userId = userdata[0]["id"];
      console.log(consoleSymbol["yes"] + " 用户<" + userInfo["nickName"] + "> 登录.");
    }
    sessionData.user_id = userId;
    // 查询用户信息
    const newUserInfo = userdata[0];
    //总是同步avatar信息为最新头像
    newUserInfo["avatar"] = userInfo['avatarUrl'];
    // 更新登录信息
    userId = await this.model('player').where({id: userId}).update({last_login_time: new Date().getTime(), last_login_ip: clientIp, avatar: userInfo.avatarUrl});
    return this.success({"userinfo": newUserInfo});
  }

  //注册账号
  //废弃
  // async registryAction(usr, pwd) {
  //   let player = this.model("player");
  //   let postdata = this.post();
  //   let username = postdata["username"];
  //   let password = postdata["password"];
  //   if (password != undefined && username != undefined) {
  //     用户名密码格式检查
  //     if (username.length < 4 || password.length < 6) {
  //       return this.fail(1002, Errors["1002"]);
  //     }
  //     const md5 = crypto.createHash("md5");
  //     password = md5.update(password).digest("hex");
  //   } else {
  //     如果以函数调用，则使用函数调用传递的参数
  //     if (usr == undefined || pwd == undefined) {
  //       return this.fail(1000, Errors["1000"]);
  //     } else {
  //       username = usr;
  //       password = pwd;
  //       if (username.length < 4 || password.length < 6) {
  //         return this.fail(1002, Errors["1002"]);
  //       }
  //       const md5 = crypto.createHash("md5");
  //       password = md5.update(password).digest("hex");
  //     }
  //   }
  //   const repeat_name = await player.where({
  //     username: username
  //   }).select();
  //   if (repeat_name.length == 0) {
  //     try {
  //       const data = await player.add({
  //         id: null,
  //         username: username,
  //         password: password,
  //         time: new Date().getTime(),
  //         coins: 0,
  //         active_role: ""
  //       });
  //       return this.success(data);
  //     } catch (e) {
  //       console.log(e);
  //       return this.fail(1006, Error["1006"]);
  //     }
  //
  //   } else {
  //     return this.fail(1001, Errors["1001"]);
  //   }
  // }

  // 每日签到增加玉石
  async checkinAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    // let cardid = postdata["cardid"];
    if (username == undefined || password == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const userdata = await player.where({username: username, password: password}).select();
    if (userdata.length != 1) {
      return this.fail(1003, Errors["1003"]);
    }
    let userinfo = userdata[0];

    //比较上次签到日期,判断是否能签到
    let checkinInfo;
    try {
      checkinInfo = JSON.parse(userinfo['checkin']);
    } catch (e) {
      //初始值为2019-6-12
      checkinInfo = {
        "last_time": "1560353724945",
        "times": 0
      };
    }

    let last_time = checkinInfo['last_time'];
    let now_time = new Date().getTime();
    let now_date = getDateFromTimeStamp(now_time);
    let last_date = getDateFromTimeStamp(last_time)
    // console.log("[*]当前签到时间:", now_date, "上次签到时间:", last_date)
    if (last_date[0] == now_date[0] && last_date[1] == now_date[1] && last_date[2] == now_date[2]) {
      return this.fail(1033, Errors["1033"]);
    }
    //可以签到,更新签到信息
    checkinInfo['last_time'] = new Date().getTime();

    //添加金币
    //每7次一个轮回，获得金币从10-70
    let coinsAward = (1 + checkinInfo['times'] % 7) * 10;
    if (checkinInfo['times'] % 100 == 0) {
      //每x00次签到额外送金币
      coinsAward += checkinInfo['times'];
    }
    console.log(consoleSymbol["info"], " 玩家<" + userinfo['username'] + ">签到成功,获得金币" + coinsAward + "个");
    userinfo['coins'] = userinfo['coins'] + coinsAward;

    checkinInfo['times'] += 1;
    userinfo['checkin'] = JSON.stringify(checkinInfo);
    try {
      let res = await player.where({id: userinfo['id']}).update({coins: userinfo['coins'], checkin: userinfo['checkin']});
      if (res) {
        return this.success(coinsAward);
      }

    } catch (e) {
      return this.fail(1004, Errors['1004']);
    }
  }

  //更改密码
  async changePwdAction(usr, pwd, newpwd) {
    let player = this.model("player");
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let newpassword = postdata["newpassword"];
    if (password != undefined && username != undefined && newpassword != undefined) {
      //用户名密码格式检查
      if (username.length < 4 || newpassword.length < 6) {
        return this.fail(1002, Errors["1002"]);
      }
      const md5 = crypto.createHash("md5");
      const md5_ = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
      newpassword = md5_.update(newpassword).digest("hex");
    } else {
      if (usr == undefined || pwd == undefined || newpwd == undefined) {
        return this.fail(1000, Errors["1000"]);
      } else {
        username = usr;
        password = pwd;
        newpassword = newpwd;
        if (username.length < 4 || newpassword.length < 6) {
          return this.fail(1002, Errors["1002"]);
        }
        const md5 = crypto.createHash("md5");
        const md5_ = crypto.createHash("md5");
        password = md5.update(password).digest("hex");
        newpassword = md5_.update(newpassword).digest("hex");
      }
    }
    const data = await player.where({username: username, password: password}).update({password: newpassword});
    // console.log(data);
    return this.success(data);
  }
  //激活角色(需要付钱)
  async activeRoleAction(uid, rid) {
    let postdata = this.post();
    let userid,
      roleid;
    if (this.method != "POST") {
      userid = uid;
      roleid = rid;
    } else {
      userid = postdata["userid"];
      roleid = postdata["roleid"];
    }
    if (userid == undefined || roleid == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");

    let playerdata = await player.where({id: userid}).select();
    let role = this.model("role");
    let roledata = await role.select();

    if (think.isEmpty(playerdata) || think.isEmpty(roledata)) {
      return this.fail(1008, Errors["1008"]);
    }
    let coins = playerdata[0]["coins"];

    let active_json = playerdata[0]["active_role"];
    if (active_json.length <= 0) {
      //非法数据
      let new_active_json = {};
      for (let r in roledata) {
        new_active_json[roledata[r]["id"]] = {
          id: roledata[r]["id"],
          active: false
        };
      }
      active_json = new_active_json;
    } else {
      active_json = JSON.parse(active_json);
    }

    if (active_json[roleid] == undefined) {
      active_json[roleid] = {
        id: roleid,
        active: false
      };
    }
    if (active_json[roleid]["active"] == true || active_json[roleid]["active"] == "true") {
      //重复激活
      return this.fail(1009, Errors["1009"]);
    }
    let price;
    for (let r in roledata) {
      if (roledata[r]["id"] == roleid) {
        price = roledata[r]["price"];
      }
    }
    if (price == undefined) {
      return this.fail(1009, Errors["1009"]);
    }
    if (coins >= price) {
      coins = coins - price;
      active_json[roleid]["active"] = true;
      let update = await player.where({id: userid}).update({coins: coins, active_role: JSON.stringify(active_json)});
      if (!update) {
        return this.fail(1004, Errors["1004"]);
      }
      return this.success();
    } else {
      return this.fail(1010, Errors["1010"]);
    }
  }
  //切换头像(无需登录)
  async changeAvatorAction() {
    let postdata = this.post();
    let userid,
      avatar;
    if (this.method != "POST") {
      return this.fail("1006", Errors["1006"]);
    } else {
      userid = postdata["userid"];
      avatar = postdata["avatar"];
    }
    let player = this.model("player");
    const data = await player.where({id: userid}).update({avatar: avatar});
    return this.success(data);
  }
  // TEST:添加经验
  // async addExpAction() {
  //   let player = this.model("player");
  //   let postdata = this.post();
  //   let username = postdata["username"];
  //   let password = postdata["password"];
  //   let exp = postdata["exp"];
  //   if (password != undefined && username != undefined) {
  //     const md5 = crypto.createHash("md5");
  //     password = md5.update(password).digest("hex");
  //   } else {
  //     return this.fail("1003", Errors["1003"]);
  //   }
  //   let data = await player.where({username: username, password: password}).select();
  //   let id = data[0]["id"];
  //   let oldExp = data[0]["exp"];
  //   let res = await player.where({id: id}).update({
  //     exp: (oldExp + exp)
  //   });
  //   if (!res) {
  //     return this.fail("1004", Errors["1004"]);
  //   }
  //   res = await player.where({id: id}).select();
  //   return this.success({"userinfo": res});
  // }
  async setAvator() {
    let player = this.modal("player");
    let postdata = this.post();
    let userid = postdata["userid"];
    let avatar = postdata["avatar"];
    let res = await player.where({id: userid}).update({avatar: avatar});
  }
  //添加好友
  async addFriendAction() {
    let player = this.model("player");
    let postdata = this.post();
    let userid = postdata["userid"];
    let friend_id = postdata["friend_id"];
    let data = await player.where({id: userid}).select();
    if (userid == friend_id) {
      return this.success({"userinfo": data})
    }
    let friends_list;
    if (data[0]["friends_list"].length == 0) {
      friends_list = [];
    } else {
      friends_list = JSON.parse(data[0]["friends_list"]);
    }
    let isFrinedAlready = false;
    for (let k of friends_list) {
      // console.log("Is Repeated?", k["id"], friend_id)
      if (k["id"] == friend_id) {
        isFrinedAlready = true;
        break;
      }
    }
    if (isFrinedAlready) {
      let res = await player.where({id: userid}).select();
      return this.success({"userinfo": res});
    }
    let data2 = await player.where({id: friend_id}).select();
    if (data2[0]["username"] == undefined) {
      return this.fail("1019", Errors["1019"]);
    }
    let other_friends_list;
    if (data2[0]['friends_list'].length == 0) {
      other_friends_list = [];
    } else {
      other_friends_list = JSON.parse(data2[0]['friends_list']);
    }
    other_friends_list.push({"id": userid, "name": data[0]["username"], "avatar": data[0]["avatar"], "exp": data[0]["exp"], "nickname": data[0]['nickname']
    });
    friends_list.push({"id": friend_id, "name": data2[0]["username"], "avatar": data2[0]["avatar"], "exp": data2[0]["exp"], "nickname": data2[0]['nickname']
    });

    //update friends_list
    let re = await player.where({id: userid}).update({"friends_list": JSON.stringify(friends_list)});
    let re2 = await player.where({id: friend_id}).update({"friends_list": JSON.stringify(other_friends_list)});
    if (re && re2) {
      let res = await player.where({id: userid}).select();
      return this.success({"userinfo": res});
    } else {
      return this.fail("1004", Errors["1004"]);
    }
  }
  //删除好友
  async delFriendAction() {
    let player = this.model("player");
    let postdata = this.post();
    let userid = postdata["userid"];
    let friend_id = postdata["friend_id"];
    let data = await player.where({id: userid}).select();
    let friends_list;
    if (data[0]["friends_list"].length == 0) {
      friends_list = [];
    } else {
      friends_list = JSON.parse(data[0]["friends_list"]);
    }
    let isFrinedAlready = false;
    for (let k of data[0]["friends_list"]) {
      if (k["id"] == friend_id) {
        isFrinedAlready = true;
        break;
      }
    }
    if (isFrinedAlready) {
      let res = await player.where({id: userid}).select();
      return this.success({"userinfo": res});
    }
    let data2 = await player.where({id: friend_id}).select();
    if (data2[0]["username"] == undefined) {
      return this.fail("1019", Errors["1019"]);
    }
    let other_friends_list;
    if (data2[0]['friends_list'].length == 0) {
      other_friends_list = [];
    } else {
      other_friends_list = JSON.parse(data2[0]['friends_list']);
    }
    other_friends_list.push({"id": userid, "name": data[0]["username"], "avatar": data[0]["avatar"], "exp": data[0]["exp"]
    });
    friends_list.push({"id": friend_id, "name": data2[0]["username"], "avatar": data2[0]["avatar"], "exp": data2[0]["exp"]
    });

    //update friends_list
    let re = await player.where({id: userid}).update({"friends_list": JSON.stringify(friends_list)});
    let re2 = await player.where({id: friend_id}).update({"friends_list": JSON.stringify(other_friends_list)});
    if (re && re2) {
      let res = await player.where({id: userid}).select();
      return this.success({"userinfo": res});
    } else {
      return this.fail("1004", Errors["1004"]);
    }
  }
  //查询用户信息
  async selectUsersAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userInfo = await this.login(username, password);
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    }
  }
  //玩家购买卡牌/制作卡牌
  async makeCardAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let cardid = postdata["cardid"];
    if (username == undefined || password == undefined || cardid == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const userdata = await player.where({username: username, password: password}).select();
    if (userdata.length != 1) {
      return this.fail(1003, Errors["1003"]);
    }
    let userinfo = userdata[0];
    let card = this.model("card");
    let cardData = await card.where({id: cardid}).select();
    if (cardData.length != 1) {
      return this.fail(1027, Errors["1027"]);
    }
    let cardinfo = cardData[0];
    cardinfo["effect"] = JSON.parse(cardinfo["effect"]);
    //根据卡牌稀有度判断卡牌价值
    let cardDefaultValue = {
      "N": 100,
      "R": 400,
      "SR": 1200,
      "SSR": 1600
    };
    let cardValue = cardDefaultValue[cardinfo["effect"]["card_rare"]];
    if (cardValue == undefined) {
      console.log(consoleSymbol["no"] + " 卡牌" + String(cardid) + "数据出现错误,卡牌价值为" + cardValue + "卡牌稀有度为" + cardinfo["effect"]["card_rare"]);
      cardValue = 1600;
    }
    //尝试购买卡牌/制作卡牌
    if (userinfo["coins"] < cardValue) {
      return this.fail(1010, Errors["1010"]);
    } else {
      //购买
      let cards_collection = JSON.parse(userinfo["cards_collection"]);
      let coins = parseInt(userinfo["coins"] - cardValue);
      cards_collection.push(parseInt(cardid, 10));
      let res = await player.where({username: username, password: password}).update({coins: coins, cards_collection: JSON.stringify(cards_collection)});
      return this.success(res);
    }
  }
  // 玩家购买基础卡包(随机5张卡牌,保底玄级卡牌)
  async buyCardBagAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    // let cardid = postdata["cardid"];
    if (username == undefined || password == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const userdata = await player.where({username: username, password: password}).select();
    if (userdata.length != 1) {
      return this.fail(1003, Errors["1003"]);
    }
    let userinfo = userdata[0];
    let card = this.model("card");
    let cardsList = await card.where({state: "enable"}).select();
    if (cardsList.length < 5) {
      return this.fail(1028, Errors['1028']);
    }
    let cardsList1 = []; //橙卡0.01
    let cardsList2 = []; //紫卡0.04
    let cardsList3 = []; //蓝卡0.35
    let cardsList4 = []; //白卡0.6
    for (let i = 0; i < cardsList.length; i++) {

      if (cardsList[i]['card_rare'] == 'SSR') {
        cardsList1.push(cardsList[i]);
      }
      if (cardsList[i]['card_rare'] == 'SR') {
        cardsList2.push(cardsList[i]);
      }
      if (cardsList[i]['card_rare'] == 'R') {
        cardsList3.push(cardsList[i]);
      }
      if (cardsList[i]['card_rare'] == 'N') {
        cardsList4.push(cardsList[i]);
      }
    }
    console.log(cardsList3);
    let cardBag = [];
    //产生一个卡包
    //正常抽卡
    for (let i = 0; i < 5; i++) {
      let card_rare_random = Math.random();
      if (card_rare_random <= 0.01) {
        //橙卡
        let cardIndex = Math.floor(Math.random() * cardsList1.length);
        console.log(consoleSymbol["info"], " 玩家" + userinfo['username'] + "获得蓝卡:" + cardsList1[cardIndex]['name']);
        cardBag.push(cardsList1[cardIndex]);
      } else if (card_rare_random <= 0.05) {
        //紫卡
        let cardIndex = Math.floor(Math.random() * cardsList2.length);
        console.log(consoleSymbol["info"], " 玩家" + userinfo['username'] + "获得紫卡:" + cardsList2[cardIndex]['name']);
        cardBag.push(cardsList2[cardIndex]);
      } else if (card_rare_random <= 0.4) {
        //蓝卡
        let cardIndex = Math.floor(Math.random() * cardsList3.length);
        console.log(consoleSymbol["info"], " 玩家" + userinfo['username'] + "获得蓝卡:" + cardsList3[cardIndex]['name']);
        cardBag.push(cardsList3[cardIndex]);
      } else {
        //白卡
        let cardIndex = Math.floor(Math.random() * cardsList4.length);
        console.log(consoleSymbol["info"], " 玩家" + userinfo['username'] + "获得白卡:" + cardsList4[cardIndex]['name']);
        cardBag.push(cardsList4[cardIndex]);
      }
    }
    //保底蓝卡
    let isNeedGuarantee = true;
    for (let i = 0; i < 5; i++) {
      if (cardBag[i]['card_rare'] == 'R' || cardBag[i]['card_rare'] == 'SR' || cardBag[i]['card_rare'] == 'SSR') {
        isNeedGuarantee = false;
        break;
      }
    }
    if (isNeedGuarantee) {
      let cardIndex = Math.floor(Math.random() * cardsList3.length);
      let removeIndex = Math.floor(Math.random() * cardBag.length);
      console.log(consoleSymbol["info"], " 玩家触发保底机制,移除卡牌" + cardBag[removeIndex]['name'] + " ,获得蓝卡:" + cardsList3[cardIndex]['name']);
      cardBag[removeIndex] = cardsList3[cardIndex];
    }

    //扣除金币
    let cardBagCost = 1200;
    if (userinfo["coins"] < cardBagCost) {
      return this.fail(1010, Errors["1010"]);
    } else {
      //购买
      let cards_collection = JSON.parse(userinfo["cards_collection"]);
      let coins = parseInt(userinfo["coins"] - cardBagCost);
      let cardid;
      for (let i = 0; i < cardBag.length; i++) {
        cardid = cardBag[i]['id'];
        console.log(consoleSymbol["yes"] + " 为玩家添加永久卡牌:", cardid);
        cards_collection.push(parseInt(cardid, 10));
      }
      let res = await player.where({username: username, password: password}).update({coins: coins, cards_collection: JSON.stringify(cards_collection)});
    }
    //添加玩家开包记录
    let cardBagLog = this.model("cardbag_log");
    let cardLog = [];
    cardBag.forEach((item, index) => {
      cardLog.push(item['id']);
    });
    await cardBagLog.add({id: null, userid: userinfo["id"], cards: JSON.stringify(cardLog), time: new Date().getTime()});

    return this.success(cardBag);
  }

  //添加一套新的套牌
  async addNewCardlistAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let cards = postdata["cards"];
    try {
      cards = JSON.parse(cards);
    } catch (e) {
      return this.fail(1029, Errors["1029"]);
    }
    if (username == undefined || password == undefined || cards == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const userdata = await player.where({username: username, password: password}).select();
    if (userdata.length != 1) {
      return this.fail(1003, Errors["1003"]);
    }
    let userinfo = userdata[0];

    let cardlist = this.model("cardlist");

    //检查是否卡组达到上限
    let cardlistStrategy = await cardlist.where({userid: userinfo["id"]}).select();
    if (cardlistStrategy.length > think.config("GameRules")["MatchGameCardListValue"]) {
      return this.fail(1031, Errors["1031"]);
    }

    let finish = 0;
    if (cards.length == think.config('GameRules')["MatchGameCardsPoolValue"]) {
      finish = 1;
    } else if (cards.length > think.config('GameRules')["MatchGameCardsPoolValue"]) {
      return this.fail(1030, Errors["1030"]);
    }
    try {
      let res = await cardlist.add({id: null, userid: userinfo['id'], finish: finish, cards: JSON.stringify(cards)});
      return this.success(res);
    } catch (e) {
      console.log(consoleSymbol["no"] + " Error occured when oprating database.", e);
      return this.fail(1004, Errors["1004"]);
    }
  }
  //删除一套套牌
  async deleteCardlistAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let cardlist_id = postdata["cardlist_id"];
    if (username == undefined || password == undefined || cardlist_id == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const userdata = await player.where({username: username, password: password}).select();
    if (userdata.length != 1) {
      return this.fail(1003, Errors["1003"]);
    }
    let userinfo = userdata[0];

    let cardlist = this.model("cardlist");
    try {
      let res = await cardlist.where({id: cardlist_id}).delete();
      return this.success(res);
    } catch (e) {
      console.log(consoleSymbol["no"] + " Error occured when oprating database.", e);
      return this.fail(1004, Errors["1004"]);
    }
  }

  //删除tmp_collection里的一张卡
  async deleteTmpCardAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let card_id = parseInt(postdata["card_id"]);
    if (username == undefined || password == undefined || card_id == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let player = this.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const userdata = await player.where({username: username, password: password}).select();
    if (userdata.length != 1) {
      return this.fail(1003, Errors["1003"]);
    }
    // console.log("[*] card_id:", card_id);
    let userinfo = userdata[0];
    let coins = parseInt(userinfo["coins"]);
    if (coins < 20) {
      return this.fail(1010, Errors["1010"]);
    }
    let isRemoved = false;
    try {
      let tmp_collection = JSON.parse(userinfo["tmp_collection"]);
      for (let i = 0; i < tmp_collection.length; i++) {
        if (parseInt(tmp_collection[i]) == parseInt(card_id)) {
          //仅移除一次
          console.log(consoleSymbol["yes"], "User <" + userinfo["nickname"] + "> Remove Card", card_id);
          tmp_collection.splice(i, 1);
          isRemoved = true;
          break;
        }
      }
      if (isRemoved) {
        //扣除20玉石
        coins -= 20;
      } else {
        return this.fail(1034, Errors["1034"]);
      }
      let res = await player.where({id: userinfo["id"]}).update({tmp_collection: JSON.stringify(tmp_collection), coins: coins});
      let userdata = await player.where({id: userinfo["id"]}).select();
      return this.success({"userinfo": userdata});
    } catch (e) {
      console.log(consoleSymbol["no"] + " Error occured when oprating database.", e);
      return this.fail(1004, Errors["1004"]);
    }
  }

  // TEST:还原一个user的单人剧情信息,方便反复测试
  // async initializeUserAction() {
  //   let postdata = this.post();
  //   let userid = postdata["id"];
  //   let player = this.model("player");
  //   let tmp_collection = postdata["tmp_collection"];
  //   let single_level = postdata["single_level"];
  //   let tmp_level = postdata["tmp_level"];
  //   if (single_level == undefined) {
  //     single_level = "1.0";
  //   }
  //   if (tmp_level == undefined) {
  //     tmp_level = "1.0";
  //   }
  //   if (tmp_collection == undefined) {
  //     tmp_collection = "[]";
  //   } else if (typeof tmp_collection != "string") {
  //     tmp_collection = JSON.stringify(tmp_collection);
  //   }
  //   let userdata = await player.where({id: userid}).select();
  //   if (userdata.length != 1) {
  //     return this.fail();
  //   }
  //   await player.where({id: userid}).update({
  //     coins: 2000,
  //     exp: 500,
  //     single_level: single_level,
  //     tmp_level: tmp_level,
  //     cards_collection: "[]",
  //     tmp_collection: tmp_collection
  //   });
  //   return this.success();
  // }

  // TEST:设置金币数量,方便测试
  // async setCoinsAction() {
  //   let postdata = this.post();
  //   let userid = postdata["id"];
  //   let code = postdata["code"];
  //   let coins = postdata["coin"];
  //   let player = this.model("player");
  //   if (code != "zxWfsdsW9824H83hSYens93yH") {
  //     return this.fail();
  //   }
  //   let userdata = await player.where({id: userid}).select();
  //   if (userdata.length != 1) {
  //     return this.fail();
  //   }
  //   await player.where({id: userid}).update({coins: parseInt(coins)});
  //   return this.success();
  // }
  // TEST:查询所有用户信息
  // async selectAllUsersAction() {
  //   let postdata = this.post();
  //   let code = postdata['code'];
  //   let pageNo = postdata['pageNo'];
  //   let pageSize = postdata['pageSize'];
  //   let player = this.model("player");
  //   if (code !== think.config("ManageMentCode")) {
  //     return this.fail();
  //   }
  //   let res = await player.page(pageNo, pageSize).select();
  //   return this.success(res);
  // }
  // TEST:查询玩家总数量
  // async selectUserCountAction() {
  //   let player = this.model('player');
  //   let code = this.post()['code'];
  //   if (code !== think.config("ManageMentCode")) {
  //     return this.fail();
  //   }
  //   let count = await player.count('id');
  //   return this.success(count);
  // }
  //静态方法
  static async isActive(uid, rid) {
    if (uid == undefined || rid == undefined) {
      return fail(1000, Errors["1000"]);
    }
    let player = think.model("player");
    let playerdata = await player.where({id: uid}).field("active_role").select();

    let active_json = playerdata[0]["active_role"];

    if (active_json.length <= 0) {
      //非法数据
      let roledata = await think.model("role").select();
      let new_active_json = {};
      for (let r in roledata) {
        new_active_json[roledata[r]["id"]] = {
          id: roledata[r]["id"],
          active: false
        };
      }
      active_json = new_active_json;
    } else {
      active_json = JSON.parse(active_json);
    }

    if (active_json[rid] == undefined) {
      active_json[rid] = {
        id: rid,
        active: false
      };
      return fail(1007, Errors["1007"]);
    } else {
      if (active_json[rid]["active"] == true || active_json[rid]["active"] == "true") {
        //get role info
        let roledata = await think.model("role").where({id: rid}).select();
        if (roledata.length != 1) {
          return fail(1022, Errors["1022"]);
        }
        return succ(roledata[0]);
      } else {
        return fail();
      }
    }
  }
  //登录
  static async login(username, password) {
    let player = think.model("player");
    if (password != undefined && username != undefined) {
      const md5 = crypto.createHash("md5");
      password = md5.update(password).digest("hex");
    } else {
      return fail(1000, Errors["1000"]);
    }
    const data = await player.where({username: username, password: password}).select();
    if (data.length == 1) {
      return succ({"userinfo": data[0]});
    } else {
      return fail(1003, Errors["1003"]);
    }
  }
  //增加经验
  static async addExp(userid, exp) {
    exp = parseInt(exp) || 0;
    let player = think.model('player');

    let data = await player.where({id: userid}).select();
    let oldExp = parseInt(data[0]["exp"]);
    let res = await player.where({id: userid}).update({
      exp: (oldExp + exp)
    });
    console.log(consoleSymbol["info"] + " User(" + userid + ") 获得了" + exp + "点经验值");
    if (!res) {
      return fail("1004", Errors["1004"]);
    }
    return succ();
  }
  //为用户新增加金币coins个
  static async addCoins(userid, coins) {
    coins = parseInt(coins) || 0;
    let player = think.model('player');
    let data = await player.where({id: userid}).select();
    let oldCoins = data[0]["coins"];
    let res = await player.where({id: userid}).update({
      coins: (oldCoins + coins)
    });
    console.log(consoleSymbol["info"] + " User(" + userid + ") 获得了" + coins + "个金币");
    if (!res) {
      return fail("1004", Errors["1004"]);
    }
    return succ();
  }

  //解析tmp_level和single_level为section和level(segment:offset)
  static deLevel(level) {
    let l = String(level);
    if (l == ".") 
      return [1, 0];
    let division = l.indexOf(".");
    if (division == -1) {
      return [parseInt(level), 0];
    } else {
      if (division == 0) {
        return [
          0,
          parseInt(l.substr(1, l.length))
        ];
      } else {
        return [
          parseInt(l.substr(0, division)),
          parseInt(l.substr(division + 1, l.length))
        ]
      }
    }
  }
  //根据chapter重置玩家的tmp_level为[section-0],于每次新开启一次章节副本时调用
  static async clearChapterLevel(userid, section) {
    let player = think.model("player");
    let chapter = think.model("chapter");
    let userdata = await player.where({id: userid}).select();
    let userinfo = userdata[0];
    let single_level = userinfo["single_level"];
    let tmp_level = userinfo["tmp_level"];
    let chap1 = this.deLevel(single_level);
    let chap2 = this.deLevel(tmp_level);
    let max_offset = await chapter.where({section: section}).select();
    max_offset.sort((a, b) => {
      a["level"] - b["level"];
    });
    max_offset = max_offset[0];
    chap2[0] = section;
    chap2[1] = 0;
    tmp_level = chap2.join(".");
    await player.where({id: userid}).update({tmp_level: tmp_level});
  }
  //更新玩家章节信息
  static async updateChapterLevel(userid) {
    let player = think.model("player");
    let chapter = think.model("chapter");
    let userdata = await player.where({id: userid}).select();
    let userinfo = userdata[0];
    let single_level = userinfo["single_level"];
    let tmp_level = userinfo["tmp_level"];
    let chap1 = this.deLevel(single_level);
    let chap2 = this.deLevel(tmp_level);
    let max_offset1 = await chapter.where({section: chap1[0]}).order('level DESC').limit(1).select();
    max_offset1 = max_offset1[0]["level"];
    let max_offset2 = await chapter.where({section: chap2[0]}).order('level DESC').limit(1).select();
    max_offset2 = max_offset2[0]["level"];

    console.log(consoleSymbol["info"] + " 当前章节:" + chap2[0] + "当前关卡:" + chap2[1] + ",关卡总数:", max_offset2);
    if (chap1[0] == chap2[0] && chap1[1] == chap2[1]) {
      //开荒
      chap1[1]++;
      chap2[1]++;
    } else {
      //刷本
      chap2[1]++;
    }
    //处理一下非法数据
    if (chap1[0] < chap2[0]) {
      console.log(consoleSymbol["no"] + " 出现非法关卡信息 single_level:" + chap1[0] + "-" + chap1[1] + ", tmp_level:" + chap2[0] + "-" + chap2[1]);
      chap1[0] = chap2[0];
    }
    if (chap1[0] == chap2[0] && chap1[1] < chap2[1]) {
      console.log(consoleSymbol["no"] + " 出现非法关卡信息 single_level:" + chap1[0] + "-" + chap1[1] + ", tmp_level:" + chap2[0] + "-" + chap2[1]);
      chap1[1] = chap2[1];
    }
    //检查越界与重置刷本信息
    if (chap1[1] > max_offset1) {
      //single_level进入下一章节
      chap1[1] = 0;
      chap1[0]++;
    }
    //tmp_level进入下一章节
    if (chap2[1] > max_offset2) {
      chap2[1] = 0;
      chap2[0]++;
    }

    if (chap2[0] > 2) {
      //当通关第二关，tmp_level重置为1-0。2也可以从数据库里获取
      chap2[1] = 0;
      chap2[0] = 1;
      //并且清空tmp卡牌
      single_level = chap1.join(".");
      tmp_level = chap2.join(".");
      await player.where({id: userid}).update({single_level: single_level, tmp_level: tmp_level, tmp_collection: "[]"});
      console.log(consoleSymbol["yes"] + " 玩家通关第一章节,目前关卡信息为single_level:" + single_level + ",tmp_level:" + tmp_level);
    } else {
      single_level = chap1.join(".");
      tmp_level = chap2.join(".");
      await player.where({id: userid}).update({single_level: single_level, tmp_level: tmp_level});
      console.log(consoleSymbol["yes"] + " 更新玩家关卡信息为single_level:" + single_level + ",tmp_level:" + tmp_level);
    }
  }
  //更新经验、金币、总卡牌,不包括临时卡牌,临时卡牌更新于socket通信中,但是永久卡牌也会加入tmp_collection
  static async updateAwards(userid) {
    let player = think.model("player");
    let chapter = think.model("chapter");
    let userdata = await player.where({id: userid}).select();
    let userinfo = userdata[0];
    let single_level = userinfo["single_level"];
    let tmp_level = userinfo["tmp_level"];
    let chap1 = this.deLevel(single_level);
    let chap2 = this.deLevel(tmp_level);
    let real_chap = chap1;
    let general = false;
    if (chap1[0] == chap2[0] && chap1[1] == chap2[1]) {
      //第一次打
      real_chap = chap1;
      general = false;
    } else {
      //日常刷本
      real_chap = chap2.concat();
      general = true;
    }
    let chaperdata = await chapter.where({section: real_chap[0], level: real_chap[1]}).select();
    let chapterInfo = chaperdata[0];
    let expAward = chapterInfo["expAward"];
    let firstCoinAward = chapterInfo["firstCoinAward"];
    let generalCoinAward = chapterInfo["generalCoinAward"];

    if (general == false) {
      //更新总卡牌奖励和firstCoin奖励,为tmp_collection添加总卡牌奖励
      let firstCardAward = JSON.parse(chapterInfo["firstCardAward"]);
      await this.addCoins(userid, firstCoinAward);
      let cards_collection = JSON.parse(userinfo["cards_collection"]);
      let tmp_collection = JSON.parse(userinfo["tmp_collection"]);
      for (let i = 0; i < firstCardAward.length; i++) {
        console.log(consoleSymbol["yes"] + " 玩家获得卡牌:", firstCardAward[i]);
        cards_collection.push(firstCardAward[i]);
        tmp_collection.push(firstCardAward[i]);
      }

      await player.where({id: userid}).update({cards_collection: JSON.stringify(cards_collection), tmp_collection: JSON.stringify(tmp_collection)});
    }
    //增加一般金币奖励和经验奖励
    await this.addCoins(userid, generalCoinAward);
    await this.addExp(userid, expAward);
    return true;
  }
  //单人剧情奖励结算，更新单人关卡卡牌信息等
  static async AdventureCheckOut(userid) {
    //更新经验、金币、总卡牌,不包括临时卡牌,临时卡牌更新于socket通信中
    await this.updateAwards(userid);
    //更新关卡信息
    await this.updateChapterLevel(userid);
    return true;
  }
};

function getDateFromTimeStamp(t) {
  let this_date = new Date(parseInt(t)).toLocaleString().split(" ")[0];
  let date_arr = this_date.split("-");
  return date_arr;
}
