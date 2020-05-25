const Base = require("./base.js");
const Player = require("./player.js");
require('./yiRan_export.js');
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

  indexAction() {
    const postData = this.post();
    let monstersNum = postData['monstersNum'];
    // const player = postData['player'];
    monstersNum = monstersNum || 1;
    const monsterList = [];
    let eachmonster;
    const SmallMonsterNameList = ["强盗", "齐国士兵", "鲁国士兵", "守城城卫", "盗贼", "蛮夷", "北戎士兵", "齐国逃兵", "鲁国逃兵"];
    for (let i = 0; i < monstersNum; i++) {
      if (i % 4 == 0) {
        //垃圾小兵量产器
        let SmallMonster = {};
        let damage = Math.ceil(Math.random(0, 1) * 3);
        let heal = Math.ceil(Math.random(0, 1) * 3);
        SmallMonster["id"] = i;
        SmallMonster["name"] = SmallMonsterNameList[Math.floor(Math.random(0, 1) * SmallMonsterNameList.length)];
        SmallMonster["skill"] = {
          pointer: 2,
          damage: damage,
          buff_turn: 999,
          settlement: 2,
          other_card_effect: {
            pointer: 1,
            protect: heal,
            buff_turn: 999,
            settlement: 2,
          }
        };
        SmallMonster["skill_description"] = ["顺劈:每回合对敌方造成" + String(damage) + "点伤害.", "防御:每回合增加" + String(heal) + "点护甲."]
        SmallMonster["type"] = "兵";
        monsterList.push(SmallMonster);
      } else if (i % 4 == 1) {
        //中级小兵量产器
        let SmallMonster = {};
        let damage = Math.ceil(Math.random(0, 1) * 3) + 5;
        let heal = Math.ceil(Math.random(0, 1) * 3) + 5;
        SmallMonster["id"] = i;
        SmallMonster["name"] = SmallMonsterNameList[Math.floor(Math.random(0, 1) * SmallMonsterNameList.length)];
        SmallMonster["skill"] = {
          pointer: 2,
          damage: damage,
          buff_turn: 999,
          settlement: 2,
          other_card_effect: {
            pointer: 1,
            protect: heal,
            buff_turn: 999,
            settlement: 2,
          }
        };
        SmallMonster["skill_description"] = ["顺劈:每回合对敌方造成" + String(damage) + "点伤害.", "防御:每回合增加" + String(heal) + "点护甲."]
        SmallMonster["type"] = "士";
        monsterList.push(SmallMonster);
      } else if (i % 4 == 2) {
        //高级小兵量产器
        let SmallMonster = {};
        let damage = Math.ceil(Math.random(0, 1) * 3) + 10;
        let heal = Math.ceil(Math.random(0, 1) * 3) + 10;
        SmallMonster["id"] = i;
        SmallMonster["name"] = SmallMonsterNameList[Math.floor(Math.random(0, 1) * SmallMonsterNameList.length)];
        SmallMonster["skill"] = {
          pointer: 2,
          damage: damage,
          buff_turn: 999,
          settlement: 2,
          other_card_effect: {
            pointer: 1,
            protect: heal,
            damage: -heal,
            buff_turn: 999,
            settlement: 2,
          }
        };
        SmallMonster["skill_description"] = ["顺劈:每回合对敌方造成" + String(damage) + "点伤害.", "防御:每回合增加" + String(heal) + "点护甲."]
        SmallMonster["type"] = "相";
        monsterList.push(SmallMonster);
      } else {
        //无奥秘王级量产器
        let SmallMonster = {};
        let damage = Math.ceil(Math.random(0, 1) * 3) + 15;
        let heal = Math.ceil(Math.random(0, 1) * 3) + 15;
        SmallMonster["id"] = i;
        SmallMonster["name"] = SmallMonsterNameList[Math.floor(Math.random(0, 1) * SmallMonsterNameList.length)];
        SmallMonster["skill"] = {
          pointer: 2,
          damage: damage,
          buff_turn: 999,
          settlement: 2,
          other_card_effect: {
            pointer: 1,
            protect: heal,
            damage: -heal,
            buff_turn: 999,
            settlement: 2,
          }
        };
        SmallMonster["skill_description"] = ["顺劈:每回合对敌方造成" + String(damage) + "点伤害.", "防御:每回合增加" + String(heal) + "点护甲."]
        SmallMonster["type"] = "王";
        monsterList.push(SmallMonster);
      }

    }
    this.success(monsterList);
    return monsterList;
  }
  //TEST:修改怪物信息
  async editMonsterAction() {
    const monster = this.model('monster');
    const postdata = this.post();
    const monster_id = postdata["id"];
    const name = postdata['name'];
    let effect = postdata['skill'].replace(/ *[\r|\n] */gm, '');
    const img = postdata['img'];
    const type = postdata['type'];
    const description = postdata['skill_description'];
    effect = JSON.stringify(JSON.parse(effect));
    try {
      const res = await monster.where({
        id: monster_id
      }).update({
        name: name,
        skill_description: description,
        img: img,
        skill: effect,
        type: type
      });
      return this.success(res);
    } catch (e) {
      console.log(e);
      return this.fail(1004, Error['1004']);
    }
  }
  //TEST:添加怪物信息
  async addMonsterAction() {
    const Monster = this.model('monster');
    const postdata = this.post();
    const name = postdata['name'];
    let skill = postdata['skill'].replace(/ *[\r|\n] */gm, '');
    const img = postdata['img'];
    const type = postdata["type"];
    const description = postdata['skill_description'];

    skill = JSON.stringify(JSON.parse(skill));
    try {
      const res = await Monster.add({
        id: null,
        name: name,
        skill_description: description,
        img: img,
        skill: skill,
        type: type
      });
      return this.success(res);
    } catch (e) {
      console.log(e);
      return this.fail(1004, Error['1004']);
    }
  }
  async selectMonstersAction() {
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
    console.log("User <" + NowUser["username"] + "> request Monsters data.");
    let monster = this.model('monster');
    let res = await monster.select();
    return this.success(res);
  }
  async selectOneMonsterAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let monster_id = postdata["monster_id"];
    let userInfo = await Player.login(username, password);
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    console.log("User <" + NowUser["username"] + "> request one monster data(id: " + monster_id + ").");
    let monster = this.model('monster');
    let res = await monster.where({
      "id": monster_id
    }).select();
    return this.success(res);
  }
}