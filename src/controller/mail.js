const Base = require("./base.js");
const Player = require("./player.js");
let Errors = think.config("Errors");
const GameMode = {};
let NowUser;
const consoleSymbol = {
  "yes": "\u001b[0;32;40m[✓]\u001b[0m",
  "no": "\u001b[0;31;40m[✗]\u001b[0m",
  "info": "\u001b[1;34;40m[*]\u001b[0m"
};
module.exports = class extends Base {
  async __before() {
    let method = this.method.toLowerCase();
    this.header("Access-Control-Allow-Origin", this.header("origin") || "*");
    this.header("Access-Control-Allow-Headers", "x-requested-with");
    this.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
    this.header('Access-Control-Allow-Credentials', true);
    if (method === "options") {
      this.end();
      return;
    }
  }
  //查询你自己的邮件与留言
  async selectMailAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userInfo = await Player.login(username, password);
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    console.log(consoleSymbol["yes"], "User <" + NowUser["username"] + "> request Mail data.");
    let Mail = this.model('mail');
    let res = await Mail.where('userid = ' + NowUser['id'] + ' OR userid = 0').select();
    return this.success(res);
  }

  //阅读一个邮件
  async readMailAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let mailid = parseInt(postdata["id"]);
    let userInfo = await Player.login(username, password);

    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    let Mail = this.model('mail');
    try {
      let mailData = await Mail.where({
        id: mailid
      }).select();
      mailData = JSON.parse(mailData);
      mailData['read'] = 1;
      let res = await Mail.where({
        id: mailid
      }).update({
        mail: JSON.stringify(mailData)
      });
      return this.success(res);
    } catch (e) {
      return this.fail(1004, Errors['1004']);
    }
  }
  //阅读指定发件人、收件人的所有聊天
  async readChatAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userid = parseInt(postdata["userid"]);
    let sender_id = parseInt(postdata["sender_id"]);
    let userInfo = await Player.login(username, password);

    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    let Mail = this.model('mail');
    try {
      let res = Mail.where({
        userid: userid,
        from: sender_id
      }).delete();
      return this.success(res);
    } catch (e) {
      return this.fail(1004, Errors["1004"]);
    }
  }
  //删除一个邮件记录
  async deleteChatAction(msgid) {
    let Mail = this.model('mail');
    try {
      let res = await Mail.where({
        id: msgid,
      }).delete();
      return true;
    } catch (e) {
      return false;
    }
  }

  //TEST:
  //向所有玩家添加一封邮件:userid为0
  async addAnnouncementAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let code = postdata['code']; //发布全员公告的code
    let userInfo = await Player.login(username, password);
    if (code != think.config("ManageMentCode")) {
      return this.fail();
    }
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    let short_title = postdata["short_title"];
    let content = postdata["content"];
    let long_title = postdata["long_title"];
    let type = 1;
    let from = "时空异闻录运营组";
    console.log(consoleSymbol["info"], "User <" + NowUser["username"] + "> request Mail data.");
    let Mail = this.model('mail');
    let mailInfo = {
      "short_title": short_title,
      "read": 0,
      "content": content,
      "long_title": long_title,
      "type": type,
      "from": from
    };
    try {
      let res = await Mail.add({
        userid: 0,
        mail: JSON.stringify(mailInfo)
      });
      return this.success(res);
    } catch (e) {
      return this.fail(1004, Errors['1004']);
    }
  }


  //添加一个离线聊天记录
  static async addChat(userid, fromid, content) {
    let short_title = "留言";
    let long_title = "您有一条未读留言";
    let type = 2;
    let from = fromid;
    console.log(consoleSymbol["info"], "User <" + NowUser["username"] + "> request Mail data.");
    let Mail = this.model('mail');
    let mailInfo = {
      "short_title": short_title,
      "read": 0,
      "content": content,
      "long_title": long_title,
      "type": type,
      "from": from
    };
    try {
      let res = await Mail.add({
        userid: userid,
        mail: JSON.stringify(mailInfo)
      });
      return true;
    } catch (e) {
      return false;
    }
  }

}