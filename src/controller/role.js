const Base = require('./base.js');
const uuid = require("es6-uuid");
const crypto = require('crypto');
const Player = require("./player.js");
let Errors = think.config('Errors');
const consoleSymbol = {
  "yes": "\u001b[0;32;40m[✓]\u001b[0m",
  "no": "\u001b[0;31;40m[✗]\u001b[0m",
  "info": "\u001b[1;34;40m[*]\u001b[0m"
};
module.exports = class Role extends Base {
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
  // 根据roleid查询一条数据
  async roleSelectAction() {
    let postdata, roleid;
    postdata = this.post();
    roleid = postdata['roleid'];
    if (roleid == undefined) {
      return this.fail(1000, Errors["1000"]);
    }
    let role = this.model('role');
    let data = role.where({
      id: roleid
    }).select();
    return this.success(data);
  }
  //查询role表中的所有数据
  async roleInfoAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userInfo = await Player.login(username, password);
    //5/15/25解锁1、2、3级故事
    let lifeStoryExp = [1013, 18010, 119648];

    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      let userinfo = userInfo["data"]["userinfo"];
      let role = this.model('role');
      console.log(consoleSymbol["yes"] + " 玩家<" + userinfo["username"] + ">请求角色数据,玩家经验:" + userinfo["exp"]);
      try {
        let data = await role.select();
        //做life_story掩盖处理
        for (let i = 0; i < data.length; i++) {
          let life_story = JSON.parse(data[i]["life_story"]);
          let cover_life_story = [];
          if (life_story.length == 0) {
            // console.log("探员<" + data[i]["name"] + ">没有生平事迹.");
            continue;
          } else {
            // console.log("探员<" + data[i]["name"] + ">有" + life_story.length + "条生平事迹.");
          }
          for (let i = 0; i < lifeStoryExp.length; i++) {
            if (lifeStoryExp[i] > userinfo["exp"] && i < life_story.length) {
              //掩盖
              cover_life_story.push("达到更高等级解锁信息。");
            } else if (lifeStoryExp[i] <= userinfo["exp"] && i < life_story.length) {
              cover_life_story.push(life_story[i]);
            }
            // console.log(cover_life_story, userinfo["exp"], lifeStoryExp[i]);
          }
          data[i]["life_story"] = JSON.stringify(cover_life_story);
        }
        return this.success(data);
      } catch (e) {
        console.log(e);
        return this.fail(1004, Errors["1004"]);
      }
    }
  }

};