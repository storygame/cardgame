const Base = require('./base.js');
const uuid = require('es6-uuid');
require('./yiRan_export.js');
const _ = require('underscore');
const Card = require("./card.js");
let Errors = think.config('Errors');
var GameRules = {
  // 玩家的萌化值的初始默认值
  CuteValueDefault: 0,
  // 玩家的星星的初始默认值
  StarValueDefault: 1,
  // 玩家冷漠值的初始默认值
  ProtectValueDefault: 0,
  // 手牌的初始
  CardsValueDefault: 4,
  // 卡池里牌的初始数量
  CardsPoolValueDefault: 40,
  // 最大回合数
  MAXBattleTurns: 60,
  // 每回合开始时抽1张牌
  DrawCardsPerTurn: 1,
  // 每回合开始时增加1个星星
  AddStarPerTurn: 3,
  //玩家的buff槽位上限
  MaxBuffNum: 5,
  //玩家的触发槽位上限
  MaxConditionNum: 5,
  //玩家的奥秘槽位上限
  MaxSecretNum: 5,
};
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
  async gameInitAction() {
    let data = this.post()
    let userid = data["userid"] || 3;
    let ai = this.PlayerInfoInit(0, "00000000");
    let player = this.PlayerInfoInit(userid, "xxxxxx");
    let game_info = this.GameInfoInit(ai, player);
    //发牌
    game_info['player1']['cards_pool'] = await Card.lotus(game_info['player1']['cards_pool_value'], 1);
    game_info['player2']['cards_pool'] = await Card.lotus(game_info['player2']['cards_pool_value'], 2);
    game_info["now_turn"] = 0;
    game_info["game_status"]["RUNNING"] = game_info["player1"];
    //发手牌
    this._card(game_info, game_info['player1'], 4);
    this._card(game_info, game_info['player2'], 4);
    // console.log(game_info);
    return this.success(game_info);
  }
  beginTurnAction() {
    let postdata = this.post();
    let game_info = postdata["data"];
    game_info = JSON.parse(game_info);
    let player, nowTurnSerialNum;
    if (game_info["now_turn"] == game_info["player1"]['id']) {
      player = game_info["player1"];
      nowTurnSerialNum = 1;
    }
    if (game_info["now_turn"] == game_info["player2"]['id']) {
      player = game_info["player2"];
      nowTurnSerialNum = 2;
    }
    if (game_info["game_status"]['RUNNING'] == undefined || game_info["game_status"] !== player) {
      game_info["game_status"]['RUNNING'] = player;
    }
    console.log("[*] Now Turn:", game_info["now_turn"], " Now player:", player['id']);

    //回合开始进行condition结算
    game_info = this.game_condition(game_info);
    // console.log("[*] game_condtion ", game_info == undefined, game_info["player1"] == undefined);
    //回合开始进行buff结算
    game_info = this.game_buff(game_info, 'begin');
    // console.log("[*] game_buff ", game_info == undefined, game_info["player1"] == undefined);
    //回合开始时玩家抽牌并增加魔法水晶
    console.log("[*] Add star for player", player['id']);
    player = this._card(game_info, player, GameRules['DrawCardsPerTurn']);
    // console.log("[*] draw card ", game_info == undefined, game_info["player1"] == undefined);
    player = this._star(player, GameRules['AddStarPerTurn']);
    // console.log("[*] star add ", game_info == undefined, game_info["player1"] == undefined);
    this.IsFinished(game_info);
    return this.success(game_info);
  }
  useOneCardAction() {
    let postdata = this.post();
    // console.log(postdata["data"]);
    // console.log(postdata["sourcePlayer"]);
    let game_info = JSON.parse(postdata["data"]);

    let sourcePlayer = JSON.parse(postdata["sourcePlayer"]);
    let card_index = postdata["card_index"];
    console.log("=====================GameInfo=====================");
    for (const i in game_info) {
      if (i != "player1" && i != "player2" && i != "game_status") {
        console.log(i, game_info[i]);
      }
    }
    console.log("=====================PlayerInfo====================");
    for (const i in sourcePlayer) {
      if (i !== 'cards_pool' && i !== 'cards_list') {
        console.log(i, sourcePlayer[i]);
      }
    }
    console.log("==================================================");
    console.log(card_index);

    let card_effect = sourcePlayer["cards_list"][card_index]['effect'];
    //标记card source
    card_effect["source"] = 0;
    console.log(card_effect);
    let c = card_effect;
    //判断玩家能否使用这张卡牌,星星是否足够
    if (sourcePlayer == undefined) {
      console.log("[*] Error: source is invalid and can not get rignt player object.");
    } else {
      if (sourcePlayer["star_value"] >= c["card_cost"]) {
        //可以使用这张牌，玩家减去使用的星星
        sourcePlayer["star_value"] -= c["card_cost"];
        console.log("[*]Info: 玩家使用了一张卡, 减去 " + c["card_cost"] + " 个Star ,还剩下 " + sourcePlayer["star_value"] + " 个星星");
        //使用前要把这张卡从玩家手里去除掉
        for (let o in sourcePlayer["cards_list"]) {
          if (o == card_index) {
            sourcePlayer["cards_list"].splice(o, 1);
            break;
          }
        }
        sourcePlayer["cards_value"]--;
      } else {
        //玩家不能使用这张牌
        console.log("[*] Info: Player use a card without enough star. Server rejects it.");
        return this.success(game_info);
      }
    }
    //出牌前进行source指定playerSerialNum
    let playerSerialNum;
    if (sourcePlayer == game_info["player1"]) {
      playerSerialNum = 1;
    }
    if (sourcePlayer == game_info["player2"]) {
      playerSerialNum = 2;
    }
    let nowCard = card_effect;
    nowCard["source"] = playerSerialNum;
    while (nowCard["other_card_effect"] != undefined) {
      nowCard = nowCard["other_card_effect"];
      nowCard["source"] = playerSerialNum;
    }
    //出牌前要进行condition结算(有可能触发condition)
    game_info = this.game_condition(game_info, card_effect, 1);
    // pointer = 0的卡牌不应该存在

    this.run_card_effect(game_info, card_effect);

    //出牌后要进行condition结算(结算后的状态有可能触发静态condition和后结算动态condition)
    game_info = this.game_condition(game_info, card_effect, 2);
    this.IsFinished(game_info);
    return this.success(game_info);
  }
  endTurnAction() {
    let postdata = this.post();
    let game_info = JSON.parse(postdata["data"]);
    let player, nowTurnSerialNum, opponent, opponentSerialNum;
    if (game_info["now_turn"] == game_info["player1"]['id']) {
      player = game_info["player1"];
      nowTurnSerialNum = 1;
      opponent = game_info["player2"];
      opponentSerialNum = 2;
    }
    if (game_info["now_turn"] == game_info["player2"]['id']) {
      player = game_info["player2"];
      nowTurnSerialNum = 2;
      opponent = game_info["player1"];
      opponentSerialNum = 1;
    }
    //回合结束进行condition结算
    game_info = this.game_condition(game_info);
    //回合结束进行buff结算
    game_info = this.game_buff(game_info, 'end');
    // 判断extra_turn信息并更改now_turn,game_status['RUNNING'],增加turns
    if (game_info["extra_turn"]["player" + String(nowTurnSerialNum)] > 0) {
      // 存在extra_turn,不切换回合
      game_info["extra_turn"]["player" + String(nowTurnSerialNum)]--;
      this.IsFinished(game_info);
    } else {
      game_info["now_turn"] = opponent['id'];
      game_info["game_status"]['RUNNING'] = opponent;
      game_info['turns']++;
      this.IsFinished(game_info);
    }
    return this.success(game_info);
  }
  /*
   * 这个函数执行了一个card_effect的解析,单独剥离这个过程是为了让other_card_effect的递归执行过程更加方便
   * 与大多数函数一样,这个函数不返回任何值(返回也不会被接收),所有对于card_effect和game_info的更改都是对引用的更改,无需返回即可生效
   */
  run_card_effect(game_info, card_effect) {
    let c = card_effect;
    if (c['pointer'] == 0) {
      console.log("[*] Error: There is a valid card with pointer 0.");
      return game_info;
    }
    //condition使用的话要加入condition列表
    if (c['condition'] !== undefined && c['condition']['pointer'] > 0 && c['condition']['pointer'] < 5) {
      if (c['condition']['secret'] == true && c['source'] == 1) {
        //添加到玩家1的secret槽位中
        if (this._addSecret(game_info["player1"], card_effect)) {
          game_info["condition1"].push(c);
        }
      }
      if (c['condition']['secret'] == true && c['source'] == 2) {
        //添加到玩家2的secret槽位中
        if (this._addSecret(game_info["player2"], card_effect)) {
          game_info["condition2"].push(c);
        }
      }
      if (c['condition']['secret'] !== true && c["source"] == 1) {
        //添加到玩家1的condition槽位中
        if (this._addCondition(game_info["player1"], card_effect)) {
          game_info["condition"].push(c);
        }
      }
      if (c['condition']['secret'] !== true && c["source"] == 2) {
        //添加到玩家2的condition槽位中
        if (this._addCondition(game_info["player2"], card_effect)) {
          game_info["condition"].push(c);
        }
      }
    } else {
      //非condition
      if (c["buff_turn"] > 0) {
        //buff结算
        if (c["source"] == 1) {
          if (this._addBuff(game_info["player1"], card_effect)) {
            if (c['settlement'] == 1 || c['settlement'] == 3 || c['settlement'] == 5) {
              //回合开始结算的buff
              game_info["buff_list1"].push(c);
            }
            if (c['settlement'] == 2 || c['settlement'] == 4 || c['settlement'] == 6) {
              game_info["buff_list2"].push(c);
            }
          }
        }
        if (c["source"] == 2) {
          if (this._addBuff(game_info["player2"], card_effect)) {
            if (c['settlement'] == 1 || c['settlement'] == 3 || c['settlement'] == 5) {
              //回合开始结算的buff
              game_info["buff_list1"].push(c);
            }
            if (c['settlement'] == 2 || c['settlement'] == 4 || c['settlement'] == 6) {
              game_info["buff_list2"].push(c);
            }
          }
        }
      } else {
        //非buff结算
        this._normal(game_info, card_effect);
      }
    }
    //执行完一层结算,根据是否拥有other_card_effect执行递归结算
    if (c["other_card_effect"] != undefined) {
      this.run_card_effect(game_info, c["other_card_effect"]);
    }

  }
  /*
   * 负责对game_info里的condition列表进行维护和结算应该结算的condition
   * 很明显这里的结算是直接算符合条件的静态condition和动态condition
   * 参数重载:如果card_effect为undefined,视为结算静态condition,否则是动态
   */

  game_condition(game_info, card_effect, condition_time) {
    let player;
    //这是一个不该存在的bug
    if (game_info['condition'] == undefined) {
      console.log("[*] Warning: Why this condition is undefined?");
      game_info['condition'] = [];
      return game_info;
    }
    //针对condition列表进行结算
    for (let c of game_info['condition']) {
      if (this._condition(game_info, c, card_effect, condition_time)) {
        //执行condition,并在game_info['condition']和player['condition_list']移除它
        for (let o in game_info['condition']) {
          if (game_info['condition'][o] == c) {
            game_info['condition'].splice(o, 1);
          }
        }
        if (c["source"] == 1) {
          player = game_info["player1"];
        }
        if (c["source"] == 2) {
          player = game_info["player2"];
        }
        for (let o in player["condition_list"]) {
          if (player["condition_list"][o] == c) {
            player["condition_list"].splice(o, 1);
          }
        }
        //执行该condition
        if (c["buff_turn"] > 0) {
          //buff结算
          if (c['settlement'] == 1 || c['settlement'] == 3 || c['settlement'] == 5) {
            //回合开始结算的buff
            game_info["buff_list1"].push(c);
          }
          if (c['settlement'] == 2 || c['settlement'] == 4 || c['settlement'] == 6) {
            game_info["buff_list2"].push(c);
          }
        } else {
          //非buff结算
          game_info = this._normal(game_info, c);
        }
      }
    }
    //condition1 执行, 玩家1 的奥秘
    for (let c of game_info["condition1"]) {
      if (this._condition(game_info, c, card_effect, condition_time)) {
        //执行condition,并在game_info["condition1"]和player1的secret_condition_list移除它
        for (let o in game_info["condition1"]) {
          if (game_info["condition1"][o] == c) {
            game_info["condition1"].splice(o, 1);
          }
        }
        if (c["source"] == 1) {
          player = game_info["player1"];
        }
        //如果是player2的话是要报错的
        if (c["source"] == 2) {
          console.log("[*] Error:有一个属于玩家2的奥秘被置入game_info['condition1'],card_effect:", c);
          player = game_info["player2"];
        }
        for (let o in player["secret_condition_list"]) {
          if (player["secret_condition_list"][o] == c) {
            player["secret_condition_list"].splice(o, 1);
          }
        }
        //执行
        if (c["buff_turn"] > 0) {
          //buff结算
          if (c['settlement'] == 1 || c['settlement'] == 3 || c['settlement'] == 5) {
            //回合开始结算的buff
            game_info["buff_list1"].push(c);
          }
          if (c['settlement'] == 2 || c['settlement'] == 4 || c['settlement'] == 6) {
            game_info["buff_list2"].push(c);
          }
        } else {
          //非buff结算
          game_info = this._normal(game_info, c);
        }
      }
    }
    //condition2 执行, 玩家2 的奥秘
    for (let c of game_info["condition2"]) {
      if (this._condition(game_info, c, card_effect, condition_time)) {
        //执行condition,并在game_info["condition2"]和player2的secret_condition_list移除它
        for (let o in game_info["condition2"]) {
          if (game_info["condition2"][o] == c) {
            game_info["condition2"].splice(o, 1);
          }
        }
        if (c["source"] == 2) {
          player = game_info["player2"];
        }
        //如果是player1的话是要报错的
        if (c["source"] == 1) {
          console.log("[*] Error:有一个属于玩家1的奥秘被置入game_info['condition2'],card_effect:", c);
          player = game_info["player1"];
        }
        for (let o in player["secret_condition_list"]) {
          if (player["secret_condition_list"][o] == c) {
            player["secret_condition_list"].splice(o, 1);
          }
        }
        //执行
        if (c["buff_turn"] > 0) {
          //buff结算
          if (c['settlement'] == 1 || c['settlement'] == 3 || c['settlement'] == 5) {
            //回合开始结算的buff
            game_info["buff_list1"].push(c);
          }
          if (c['settlement'] == 2 || c['settlement'] == 4 || c['settlement'] == 6) {
            game_info["buff_list2"].push(c);
          }
        } else {
          //非buff结算
          game_info = this._normal(game_info, c);
        }
      }
    }
    return game_info;
  }
  game_buff(game_info, time) {
    if (time == 'begin') {
      if (game_info["buff_list1"].length == 0) {
        return game_info;
      }
      for (let o in game_info["buff_list1"]) {
        game_info = this._buff(game_info, game_info["buff_list1"][o]);
      }
    } else if (time == 'end') {
      if (game_info["buff_list2"].length == 0) {
        return game_info;
      }
      for (let o in game_info["buff_list2"]) {
        game_info = this._buff(game_info, game_info["buff_list2"][o]);
      }
    } else {
      console.log("[*]Error: Invalid parameters.");
    }
    //从检查buff_list,移除无效buff,如果在player中的buff也有这个buff,移除它
    let tmp_c, player;
    for (let o in game_info["buff_list1"]) {
      tmp_c = game_info["buff_list1"][o];
      player = game_info["player" + String(game_info["buff_list1"][o]["source"])];
      if (player == undefined) {
        console.log("[*] Error:在移除buff时出现一个没有source指向的card,card_effect:", game_info["buff_list1"][o]);
      }
      if (game_info["buff_list1"][o]["buff_turn"] <= 0) {
        game_info["buff_list1"].splice(o, 1);
        //在player的buff中移除这个buff
        for (let player_o in player["buff_list"]) {
          if (player["buff_list"][player_o] == tmp_c) {
            player["buff_list"].splice(player_o, 1);
          }
        }
      }
    }
    for (let o in game_info["buff_list2"]) {
      tmp_c = game_info["buff_list2"][o];
      player = game_info["player" + String(game_info["buff_list2"][o]["source"])];
      if (game_info["buff_list2"][o]["buff_turn"] <= 0) {
        game_info["buff_list2"].splice(o, 1);
        //在player的buff中移除这个buff
        for (let player_o in player["buff_list"]) {
          if (player["buff_list"][player_o] == tmp_c) {
            player["buff_list"].splice(player_o, 1);
          }
        }
      }
    }
    return game_info;
  }
  /* --------------------------------------------------卡牌结算------------------------------------------------------------ */
  _condition(game_info, card_effect, aim_card_effect, condition_time) {
    if (aim_card_effect == undefined) {
      //通过condition_time来判断是否是静态结算,调用静态结算,
      if (card_effect["condition"]["condition_time"] == undefined || card_effect["condition"]["condition_time"] == 0) {
        return this._condition_static(game_info, card_effect);
      }
      // 原来的静态奥秘判断,通过所有项进行判断
      // if ((card_effect["damage"] == 0 || card_effect["damage"] == undefined) && (card_effect["cards"] == 0 || card_effect["cards"] == undefined) && (card_effect["star"] == 0 || card_effect["star"] == undefined) && (card_effect["protect"] == 0 || card_effect["protect"] == undefined))
    } else {
      //通过condition_time来判断是否是动态结算,调用动态结算,动态结算包含静态结算和动态结算
      // 原来的动态奥秘判断,通过所有项进行判断
      // if (!((card_effect["damage"] == 0 || card_effect["damage"] == undefined) && (card_effect["cards"] == 0 || card_effect["cards"] == undefined) && (card_effect["star"] == 0 || card_effect["star"] == undefined) && (card_effect["protect"] == 0 || card_effect["protect"] == undefined)))
      if (card_effect["condition"]["condition_time"] == 1 || card_effect["condition"]["condition_time"] == 2) {
        if (condition_time === card_effect["condition"]["condition_time"]) {
          //condition_time符合的动态condition才能进行判断结算
          console.log("[*] Debug: 执行一个动态奥秘判断,是否成功执行:", this._condition_dynamic(game_info, card_effect, aim_card_effect), this._condition_static(game_info, card_effect));
          console.log(card_effect);
          return this._condition_dynamic(game_info, card_effect, aim_card_effect) && this._condition_static(game_info, card_effect);
        } else {
          return false;
        }
      } else {
        //注意aim_card_effect不是undefined也可能是一个需要静态判定的condition
        return this._condition_static(game_info, card_effect);
      }
    }
  }
  /*
   * 返回true或false, 判断这个condition是否应该被执行.
   * 静态condition中的card_effect参数是指condition本身.
   * 这个函数常用于回合开始和回合结束时调用
   */
  _condition_static(game_info, card_effect) {
    let c = card_effect;
    let TwoAim = false;
    let playerAim, playerAimNum; // 此处的playerAim是指condition判断的指向对象,而并非执行指向的对象,执行指向的对象将在_normal里判断并更改状态
    let satisfy = true;
    //pointer合法检查和目标确认
    if (c['pointer'] < 0 || c['pointer'] > 4 || c['condition']['pointer'] < 0 || c['condition']['pointer'] > 4) {
      console.log("[*] Error: Unexpected pointer value, not in [0,4].");
      return game_info;
    }
    if (c['condition']['pointer'] == 0) {
      return game_info;
    } else {
      if (c['condition']['pointer'] == 3) {
        TwoAim = true;
      }
      if (c['condition']['pointer'] == 4) {
        playerAimNum = _.random(1, 2);
        playerAim = game_info['player' + String(playerAimNum)];
      }
      if (c['condition']['pointer'] == 1 && c['source'] == 1) {
        playerAim = game_info["player1"];
        playerAimNum = 1;
      }
      if (c['condition']['pointer'] == 1 && c['source'] == 2) {
        playerAim = game_info["player2"];
        playerAimNum = 2;
      }
      if (c['condition']['pointer'] == 2 && c['source'] == 1) {
        playerAim = game_info["player2"];
        playerAimNum = 2;
      }
      if (c['condition']['pointer'] == 2 && c['source'] == 2) {
        playerAim = game_info["player1"];
        playerAimNum = 1;
      }
    }
    /*
     * 已经确认了condition目标
     * TwoAim表示对双方都生效
     * RandomAim表示随机选择目标,已选择完毕存入playerAim
     * playerAim 存放的目标生效对象
     * playerAimNum 表示目标的序号(1|2)
     */
    if (TwoAim == true) {
      // 双方的属性值都满足condition才执行
      if (c['condition']["cute_value"] !== 0) {
        if (!(operand_result(c['condition']["cute_value_operand"], game_info["player1"]["cute_value"], c['condition']["cute_value"]) && operand_result(c['condition']["cute_value_operand"], game_info["player2"]["cute_value"], c['condition']["cute_value"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["cards_value"] !== -1) {
        if (!(operand_result(c['condition']["cards_value_operand"], game_info["player1"]["cards_value"], c['condition']["cards_value"]) && operand_result(c['condition']["cards_value_operand"], game_info["player2"]["cards_value"], c['condition']["cards_value"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["star_value"] !== -1) {
        if (!(operand_result(c['condition']["star_value_operand"], game_info["player1"]["star_value"], c['condition']["star_value"]) && operand_result(c['condition']["star_value_operand"], game_info["player2"]["star_value"], c['condition']["star_value"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["protect_value"] !== -1) {
        //特殊值处理无视operand
        if (c['condition']["protect_value"] == -1000) {
          // 玩家处于无法获得冷漠值1次的特殊状态
          let sp_operand = {
            'value': -1000,
            'times': 1
          };
          let specialSatisfy1 = false,
            specialSatisfy2 = false;
          for (let t of game_info["player1"]["protect_special"]) {
            if (t['value'] == sp_operand['value'] && t['times'] >= sp_operand['times']) {
              specialSatisfy1 = true;
              break;
            }
          }
          for (let t of game_info["player2"]["protect_special"]) {
            if (t['value'] == sp_operand['value'] && t['times'] >= sp_operand['times']) {
              specialSatisfy2 = true;
              break;
            }
          }
          if (!(specialSatisfy1 == true && specialSatisfy2 == true)) {
            satisfy = false;
          }
        } else if (c['condition']["protect_value"] == 1000) {
          // 玩家处于免疫的特殊状态
          let sp_operand = {
            'value': 1000,
            'times': 0
          };
          let specialSatisfy1 = false,
            specialSatisfy2 = false;
          for (let t of game_info["player1"]["protect_special"]) {
            if (t['value'] == sp_operand['value'] && t['times'] == sp_operand['times']) {
              specialSatisfy1 = true;
              break;
            }
          }
          for (let t of game_info["player2"]["protect_special"]) {
            if (t['value'] == sp_operand['value'] && t['times'] == sp_operand['times']) {
              specialSatisfy2 = true;
              break;
            }
          }
          if (!(specialSatisfy1 == true && specialSatisfy2 == true)) {
            satisfy = false;
          }
        } else {
          if (!(operand_result(c['condition']["protect_value_operand"], game_info["player1"]["protect_value"], c['condition']["protect_value"]) && operand_result(c['condition']["protect_value_operand"], game_info["player2"]["protect_value"], c['condition']["protect_value"]))) {
            satisfy = false;
          }
        }
      }
      return satisfy;
    } else {
      //playerAim生效
      if (c['condition']["cute_value"] !== 0) {
        if (!(operand_result(c['condition']["cute_value_operand"], playerAim["cute_value"], c['condition']["cute_value"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["cards_value"] !== -1) {
        if (!(operand_result(c['condition']["cards_value_operand"], playerAim["cards_value"], c['condition']["cards_value"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["star_value"] !== -1) {
        if (!(operand_result(c['condition']["star_value_operand"], playerAim["star_value"], c['condition']["star_value"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["protect_value"] !== -1) {
        //特殊值处理无视operand
        if (c['condition']["protect_value"] == -1000) {
          // 玩家处于无法获得冷漠值1次的特殊状态
          let sp_operand = {
            'value': -1000,
            'times': 1
          };
          let specialSatisfy = false;
          for (let t of playerAim["protect_special"]) {
            if (t['value'] == sp_operand['value'] && t['times'] >= sp_operand['times']) {
              specialSatisfy = true;
              break;
            }
          }
          if (!(specialSatisfy == true)) {
            satisfy = false;
          }
        } else if (c['condition']["protect_value"] == 1000) {
          // 玩家处于免疫的特殊状态
          let sp_operand = {
            'value': 1000,
            'times': 0
          };
          let specialSatisfy1 = false;
          for (let t of playerAim["protect_special"]) {
            if (t['value'] == sp_operand['value'] && t['times'] == sp_operand['times']) {
              specialSatisfy1 = true;
              break;
            }
          }
          if (!(specialSatisfy1 == true)) {
            satisfy = false;
          }
        } else {
          if (!(operand_result(c['condition']["protect_value_operand"], playerAim["protect_value"], c['condition']["protect_value"]))) {
            satisfy = false;
          }
        }
      }
      return satisfy;
    }
  }
  /*
   * 返回true或false, 判断这个condition是否应该被执行.
   * 动态condition中的card_effect参数是指condition本身.
   * aim_card_effect是作为触发动态condition所使用的卡牌的card_effect
   * 这个函数常用于useCard后调用
   */
  _condition_dynamic(game_info, cond_card_effect, aim_card_effect) {
    let c = cond_card_effect;
    let d = aim_card_effect;
    let TwoCondAim = false,
      TwoUseAim = false;
    let playerAim, playerAimNum; // 此处的playerAim是指condition判断的指向对象,而并非执行指向的对象
    let playerUse, playerUseNum; // 此处的playerUse是指玩家使用的卡牌(aim_card_effect)的指向对象
    let satisfy = true;
    //pointer合法检查和目标确认
    if (c['pointer'] < 0 || c['pointer'] > 4 || c['condition']['pointer'] < 0 || c['condition']['pointer'] > 4) {
      console.log("[*] Error: Unexpected pointer value, not in [0,4].");
      return false;
    }
    if (c['condition']['pointer'] == 0) {
      return false;
    } else {
      if (c['condition']['pointer'] == 3) {
        TwoCondAim = true;
      }
      if (c['condition']['pointer'] == 4) {
        playerAimNum = _.random(1, 2);
        playerAim = game_info['player' + String(playerAimNum)];
      }
      if (c['condition']['pointer'] == 1 && c['source'] == 1) {
        playerAim = game_info["player1"];
        playerAimNum = 1;
      }
      if (c['condition']['pointer'] == 1 && c['source'] == 2) {
        playerAim = game_info["player2"];
        playerAimNum = 2;
      }
      if (c['condition']['pointer'] == 2 && c['source'] == 1) {
        playerAim = game_info["player2"];
        playerAimNum = 2;
      }
      if (c['condition']['pointer'] == 2 && c['source'] == 2) {
        playerAim = game_info["player1"];
        playerAimNum = 1;
      }
    }
    // 判断useCard的指向目标
    if (d['pointer'] < 0 || d['pointer'] > 4) {
      console.log("[*] Error: Unexpected pointer value, not in [0,4].");
      return false;
    }
    if (d['pointer'] == 0) {
      return false;
    }
    if (d['pointer'] == 3) {
      TwoUseAim = true;
    }
    if (d['pointer'] == 4) {
      playerUseNum = _.random(1, 2);
      playerUse = game_info['player' + String(playerUseNum)];
    }
    if (d['pointer'] == 1 && d['source'] == 1) {
      playerUse = game_info["player1"];
      playerUseNum = 1;
    }
    if (d['pointer'] == 1 && d['source'] == 2) {
      playerUse = game_info["player2"];
      playerUseNum = 2;
    }
    if (d['pointer'] == 2 && d['source'] == 1) {
      playerUse = game_info["player2"];
      playerUseNum = 2;
    }
    if (d['pointer'] == 2 && d['source'] == 2) {
      playerUse = game_info["player1"];
      playerUseNum = 1;
    }
    //只有当使用卡牌的结算目标和动态condition的条件目标一致时,这个条件才有可能满足
    //例:当己方受到伤害大于5,这个己方是指具体的条件目标.
    //这个目标需要和使用的"使对手萌化值增加6点"中的"对手"指向的是同一目标才行
    console.log("playerUseNum:" + playerUseNum + ", playerAimNum:" + playerAimNum);
    if (playerUseNum !== playerAimNum || TwoUseAim !== TwoCondAim) {
      return false;
    }
    /*
     * 已经确认了condition目标
     * TwoAim表示对双方都生效
     * RandomAim表示随机选择目标,已选择完毕存入playerAim
     * playerAim 存放的目标生效对象
     * playerAimNum 表示目标的序号(1|2)
     */
    if (TwoUseAim && TwoCondAim) {
      if (c['condition']["damage"] !== 0) {
        if (!(operand_result(c['condition']["damage_operand"], d["damage"], c['condition']["damage"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["cards"] !== -1) {
        if (!(operand_result(c['condition']["cards_operand"], d["cards"], c['condition']["cards"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["star"] !== -1) {
        if (!(operand_result(c['condition']["star_operand"], d["star"], c['condition']["star"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["protect"] !== -1) {
        if (!(operand_result(c['condition']["protect_operand"], d["protect"], c['condition']["protect"]))) {
          satisfy = false;
        }
      }
    } else {
      if (c['condition']["damage"] !== 0) {
        if (!(operand_result(c['condition']["damage_operand"], d["damage"], c['condition']["damage"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["cards"] !== -1) {
        if (!(operand_result(c['condition']["cards_operand"], d["cards"], c['condition']["cards"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["star"] !== -1) {
        if (!(operand_result(c['condition']["star_operand"], d["star"], c['condition']["star"]))) {
          satisfy = false;
        }
      }
      if (c['condition']["protect"] !== -1) {
        if (!(operand_result(c['condition']["protect_operand"], d["protect"], c['condition']["protect"]))) {
          satisfy = false;
        }
      }
    }
    return satisfy;
  }


  /* 进行buff结算,更改player状态和buff_turn的同时也会检查并移除buff_list里的无效buff */
  _buff(game_info, card_effect) {
    //注意此处card_effect是game_info的buff_list中记录的一个对象,他的更改会影响到buff_list里记录的对象
    let c = card_effect;
    if (c["buff_turn"] > 0) {
      game_info = this._normal(game_info, card_effect);
      c["buff_turn"]--;
    }
    // return game_info;
    /*
     * buff结算并不负责维护game_info里的buff_list的合法性(因为在condition中还要调用_buff来做对condition的结算)
     * buff_list的维护过程将放到game_info的整体维护中(即调用buff/condition执行的地方)
     * 这里只是对一张合法的buff进行执行,影响的只是card_effect和game_info里的player状态
     */
    return game_info;
  }
  _normal(game_info, card_effect) {
    let TwoAim = false; //两个目标结算
    let RandomAim = false; //随机目标结算
    let playerAim, playerAimNum;
    let c = card_effect; //card_effect的缩写
    //pointer合法检查和目标确认
    if (c['pointer'] < 0 || c['pointer'] > 4) {
      console.log("[*] Error: Unexpected pointer value, not in [0,4].");
      return game_info;
    }
    if (c['pointer'] == 0) {
      return game_info;
    }
    if (c['pointer'] == 3) {
      TwoAim = true;
    }
    if (c['pointer'] == 4) {
      RandomAim = true;
      playerAimNum = _.random(1, 2);
      playerAim = game_info['player' + String(playerAimNum)];
      //不该发生的 serial number 拼接错误
      if (playerAim == undefined) {
        console.log("[*] Error: player serial code is illegal. Serial Code: " + 'player' + String(playerAimNum));
      }
    }
    if (RandomAim == false && TwoAim == false) {
      if (c['source'] == 1) {
        if (c['pointer'] == 1) {
          //对己方生效
          playerAimNum = 1;
          playerAim = game_info["player1"];
        } else if (c['pointer'] == 2) {
          //对对方生效
          playerAimNum = 2;
          playerAim = game_info["player2"];
        }
      } else
      if (c['source'] == 2) {
        if (c['pointer'] == 1) {
          //对己方生效
          playerAimNum = 2;
          playerAim = game_info["player2"];
        } else if (c['pointer'] == 2) {
          //对对方生效
          playerAimNum = 1;
          playerAim = game_info["player1"];
        }
      } else {
        console.log("[*] Error: card source is invalid", c['source']);
      }
    }
    /*
     * 已经确认了目标
     * TwoAim表示对双方都生效
     * RandomAim表示随机选择目标,已选择完毕存入playerAim
     * playerAim 存放的目标生效对象
     * playerAimNum 表示目标的序号(1|2)
     * _damage等函数传入的object的引用,所以无需接收返回值,object内的值已经改变
     * 但函数内的return是必须的,为了逻辑中断.
     */
    if (TwoAim) {
      this._damage(game_info, game_info["player1"], c['damage']);
      this._card(game_info, game_info["player1"], c['cards']);
      this._star(game_info["player1"], c['star']);
      this._protect(game_info["player1"], c['protect']);
      this._turn(game_info, game_info["player1"], c["extra_turn"]);

      this._damage(game_info, game_info["player2"], c['damage']);
      this._card(game_info, game_info["player2"], c['cards']);
      this._star(game_info["player2"], c['star']);
      this._protect(game_info["player2"], c['protect']);
      this._turn(game_info, game_info["player2"], c["extra_turn"]);
    } else {
      if (playerAim == undefined) {
        console.log("[*] Error: 根据卡牌得出的结算目标player为undefined!");
        return game_info;
      }
      this._damage(game_info, playerAim, c['damage']);
      this._card(game_info, playerAim, c['cards']);
      this._star(playerAim, c['star']);
      this._protect(playerAim, c['protect']);
      this._turn(game_info, playerAim, c["extra_turn"]);
    }
    return game_info;
  }
  _damage(game_info, player, damage) {
    //这里的pointer是指作用目标
    let lower = 0;
    let upper = 40;
    damage = parseInt(damage, 10);
    //特殊值处理
    if (damage == 999) {
      //player直接获得胜利,这里对game_info的处理不需要返回即可生效
      game_info["game_status"]['FINISHED'] = player;
      return player;
    }
    if (damage == -999) {
      //player直接回复满血
      player["cute_value"] = GameRules['CuteValueDefault'];
      return player;
    }
    if (damage > 0) {
      if (player["protect_special"] != undefined) {
        if (player["protect_special"].length > 0) {
          for (let o in player["protect_special"]) {
            if (player["protect_special"][o]['value'] == 999 && player["protect_special"][o]['times'] > 0) {
              player["protect_special"][o]['times']--;
              damage = 0;
              if (player["protect_special"][o]['times'] == 0) {
                player["protect_special"].splice(o, 1);
              }
              return player;
            }
            if (player["protect_special"][o]['value'] == 1000) {
              //这是个buff效果，所以生效时间不是这里控制,不生效的话这里不会为1000
              damage = 0;
              return player;
            }
          }
        }
      }
      // protect可以抵消damage
      if (player["protect_value"] > 0) {
        if (player["protect_value"] >= damage) {
          // protect足以抵消所有伤害
          player["protect_value"] -= damage;
          damage = 0;
          return player;
        } else {
          // protect不足以抵消所有伤害，只能抵消部分伤害
          damage -= player["protect_value"];
          player["protect_value"] = 0;
        }
      }
    }
    if (damage > 0) {
      //受到伤害,萌化值增加
      player["cute_value"] += damage;
    }
    if (damage < 0) {
      //受到治愈,萌化值减少
      player["cute_value"] += damage;
    }
    //bound limit
    if (player["cute_value"] < lower) {
      player["cute_value"] = lower;
    }
    if (player["cute_value"] > upper) {
      player["cute_value"] = upper;
    }
    if (isNaN(player["cute_value"])) {
      console.log("[*] Error: Cute_value is NaN! What happened?");
      player["cute_value"] = upper;
    }
    return player;
  }
  _card(game_info, player, cards) {
    let cards_lower = 0;
    let cards_upper = 8;
    let cardpool_lower = 0;
    let cardpool_upper = 40;

    cards = parseInt(cards, 10);
    //特殊值处理
    if (cards == 999) {
      cards = player["cards_pool"].length;
    }
    if (cards == -999) {
      cards = -1 * player["cards_value"];
    }

    //清空抽牌顺序list和弃牌顺序list
    player["draw_list"] = [];
    player["discard_list"] = [];
    if (cards > 0) {
      //抽牌
      for (var i = 0; i < cards; i++) {
        if (player["cards_pool"].length > cardpool_lower) {
          //从牌库抽一张牌
          let new_card = player["cards_pool"].pop();
          player["cards_pool_value"]--;
          player["draw_list"].push(new_card);
          //置入手牌,如果没达到上限的话
          if (player["cards_value"] < cards_upper) {
            player["cards_list"].push(new_card);
            player["cards_value"]++;
          }
        } else {
          //无牌可抽,扣疲劳
          console.log("[*]Info: 玩家" + player["id"] + "抽牌被扣除" + player["tired"] + "点疲劳.");
          this.damage(game_info, player, player["tired"]);
          player['tired'] += 1;
        }
      }
    } else {
      //弃手牌
      cards = cards * -1;
      for (i = 0; i < cards; i++) {
        if (player["cards_value"] > cards_lower) {
          player["cards_list"] = _.shuffle(player["cards_list"]);
          let discard_list = player["cards_list"].pop();
          player["discard_list"].push(discard_list);
          player["cards_value"]--;
        }
      }
    }
    return player;
  }
  _star(player, star) {
    let lower = 0;
    let upper = 12;

    star = parseInt(star, 10);
    //特殊值处理
    if (star == 999) {
      star = upper;
    }
    if (star == -999) {
      star = -1 * upper;
    }
    if (star > 0) {
      //增加星星
      player["star_value"] += star;
    } else {
      //减少星星
      player["star_value"] += star;
    }
    if (player["star_value"] < lower) {
      player["star_value"] = lower;
    }
    if (player["star_value"] > upper) {
      player["star_value"] = upper;
    }
    return player;
  }
  _protect(player, protect) {
    let lower = 0;
    let upper = 300;

    protect = parseInt(protect, 10);
    //特殊值处理
    if (protect == 999) {
      //抵消任何伤害一次,不可叠加
      player["protect_special"].push({
        'value': 999,
        'times': 1,
      });
      return player;
    }
    if (protect == 1000) {
      //永久免疫
      player["protect_special"].push({
        'value': 1000,
        'times': 0,
      });
      return player;
    }
    if (protect == -999) {
      //清除所有护甲
      protect = -1 * player["protect_value"];
    }
    if (protect == -1000) {
      //无法获得护甲1次,不可叠加
      player["protect_special"].push({
        'value': -1000,
        'times': 1,
      });
      return player;
    }
    if (protect > 0) {
      if (player["protect_special"].length > 0) {
        for (let i in player["protect_special"]) {
          if (player["protect_special"][i]['value'] == -1000 && player["protect_special"][i]['times'] >= 1) {
            //无法获得护甲
            protect = 0;
            player["protect_special"][i]['times']--;
            if (player["protect_special"][i]['times'] == 0) {
              player["protect_special"].splice(i, 1);
            }
          }
        }
      }
      //增加护甲
      player["protect_value"] += protect;
    } else {
      //护甲减少
      player["protect_value"] += protect;
    }
    if (player["protect_value"] < lower) {
      player["protect_value"] = lower;
    }
    if (player["protect_value"] > upper) {
      player["protect_value"] = upper;
    }
    return player;
  }
  _turn(game_info, player, turn) {
    let lower = 0;
    let upper = 3;
    turn = parseInt(turn);
    let playerString;
    if (player["id"] == game_info["player1"]["id"]) {
      playerString = "player1";
    }
    if (player["id"] == game_info["player2"]["id"]) {
      playerString = "player2";
    }
    if (isNaN(turn)) {
      return game_info;
    }
    if (turn > 0) {
      game_info["extra_turn"][playerString] += turn;
    }
    if (game_info["extra_turn"] > upper) {
      game_info["extra_turn"][playerString] = upper;
    }
    if (game_info["extra_turn"] < lower) {
      game_info["extra_turn"][playerString] = lower;
    }
  }
  _addCondition(player, card_effect) {
    if (player["condition_list"].length == GameRules.MaxConditionNum) {
      return false;
    } else {
      player["condition_list"].push(card_effect);
      return true;
    }
  }
  _addSecret(player, card_effect) {
    if (player["secret_condition_list"].length == GameRules.MaxSecretNum) {
      return false;
    } else {
      player["secret_condition_list"].push(card_effect);
      return true;
    }
  }
  _addBuff(player, card_effect) {
    if (player["buff_list"].length == GameRules.MaxBuffNum) {
      return false;
    } else {
      if (card_effect == undefined) {
        console.log("[*] Error: Wrong Buff card effect is added.");
      }
      player["buff_list"].push(card_effect);
      return true;
    }
  }
  /*
   * GameJSON 和 PlayerJson 初始化
   */
  GameInfoInit(player1, player2) {
    //直到创建game时才分配UUID
    let session = uuid(32);
    player1["session_id"] = session;
    player2["session_id"] = session;
    let one_game = {
      "player1": player1,
      "player2": player2,
      'session': session,
      "buff_list1": [],
      "buff_list2": [],
      "condition:": [],
      "condition1": [],
      "condition2": [],
      'scene': 0,
      "now_turn": yiRan(0, 1, 1) == 1 ? player1['id'] : player2['id'],
      'turns': 0,
      "extra_turn": {
        "player1": 0,
        "player2": 0
      },
      "game_status": {
        'FINISHED': undefined,
        'RUNNING': undefined
      }
    };
    return one_game;
  }
  PlayerInfoInit(userid, socket_id) {
    let player = {};
    //因为创建玩家JSON的时候是已经匹配到对手之后，所以game_status = 1
    player['id'] = userid;
    player['socket'] = socket_id;
    player['status'] = 1;
    player["cute_value"] = GameRules['CuteValueDefault'];
    player["cards_value"] = GameRules['CardsValueDefault'];
    player["star_value"] = GameRules['StarValueDefault'];
    player["protect_value"] = GameRules['ProtectValueDefault'];
    player["protect_special"] = [];
    player["cards_pool_value"] = GameRules['CardsPoolValueDefault'];
    player["cards_pool"] = [];
    player["cards_list"] = [];
    player["buff_list"] = [];
    player["condition_list"] = [];
    player["draw_list"] = [];
    player["discard_list"] = [];
    player["secret_condition_list"] = [];
    player["tired"] = 1;
    return player;
  }
  /*
   * 游戏特殊状态检查
   * game_info处理
   */
  PlayerInfoFilter(game, p) {
    /*
     *  TODO:需要重构，根据现有的filter_list来过滤信息
     *  返回的player1总会是玩家p自己，player2总是对手
     */
    //过滤不该发的信息
    let filter_game_info = {
      'session': game['session'],
      "buff_list1": game["buff_list1"],
      "buff_list2": game["buff_list2"],
      'condition': game['condition'],
      'scene': game['sceen'],
      "now_turn": game["now_turn"],
      'turns': game['turns']
    };
    let player;
    //保留玩家1应该知道的东西
    if (game["player1"]['id'] == p['id']) {
      filter_game_info["player1"] = game["player1"];
      filter_game_info["condition"] = game["condition"];
      filter_game_info["condition1"] = game["condition1"];
      filter_game_info["condition2"] = [];
      let player2, cond;
      player = game["player2"];
      player2 = {
        //游戏对局信息
        id: player['id'], // 玩家的player ID.
        session_id: player["session_id"], // 一个session ID 来标记玩家正处于的对局
        status: player['status'], //0表示在匹配中,1表示匹配完成在房间中,2表示在游戏对局中
        //对局信息
        role: player['role'], //玩家对局所使用的role id
        skill: player['skill'], //玩家所使用的role的技能effect解释(effect Json String)
        cute_value: player["cute_value"], //n in [0,40]
        star_value: player["star_value"], //n in [0,12]
        protect_value: player["protect_value"], // n in [0,]
        protect_special: player["protect_special"],
        cards_value: player["cards_value"], //n in [0,8]
        cards_list: [],
        cards_pool_value: player["cards_pool_value"], // [0,]玩家牌库里还剩多少张牌
        cards_pool: [],
        tired: player['tired'],
        draw_list: player["draw_list"], // 用于前后端核对抽牌的顺序
        discard_list: player["discard_list"], // 用于前后段核对弃牌的顺序
        buff_list: player["buff_list"],
        condition_list: player["condition_list"],
        secret_condition_list: []
      };
      //奥秘的掩盖处理
      for (let k in game["condition2"]) {
        cond = {
          "condition": {
            "secret": true
          },
          "source": k["source"]
        };
        filter_game_info["condition2"].push(cond);
      }
      for (let k in player["secret_condition_list"]) {
        cond = {
          "condition": {
            "secret": true
          },
          "source": k["source"]
        };
        player2["secret_condition_list"].push(cond);
      }
      filter_game_info["player2"] = player2;
    }
    if (game["player2"]['id'] == p['id']) {
      filter_game_info["player2"] = game["player2"];
      filter_game_info["condition"] = game["condition"];
      filter_game_info["condition2"] = game["condition2"];
      filter_game_info["condition1"] = [];
      let player1, cond;
      player = game["player1"];
      player1 = {
        //游戏对局信息
        id: player['id'], // 玩家的player ID.
        session_id: player["session_id"], // 一个session ID 来标记玩家正处于的对局
        status: player['status'], //0表示在匹配中,1表示匹配完成在房间中,2表示在游戏对局中
        //对局信息
        role: player['role'], //玩家对局所使用的role id
        skill: player['skill'], //玩家所使用的role的技能effect解释(effect Json String)
        cute_value: player["cute_value"], //n in [0,40]
        star_value: player["star_value"], //n in [0,12]
        protect_value: player["protect_value"], // n in [0,]
        protect_special: player["protect_special"],
        cards_value: player["cards_value"], //n in [0,8]
        cards_list: [],
        cards_pool_value: player["cards_pool_value"], // [0,]玩家牌库里还剩多少张牌
        cards_pool: [],
        tired: player['tired'],
        draw_list: player["draw_list"],
        discard_list: player["discard_list"],
        buff_list: player["buff_list"],
        condition_list: player["condition_list"],
        secret_condition_list: []
      };
      //奥秘的掩盖处理
      for (let k in game["condition1"]) {
        cond = {
          "condition": {
            "secret": true
          },
          "source": k["source"]
        };
        filter_game_info["condition1"].push(cond);
      }
      for (let k in player["secret_condition_list"]) {
        cond = {
          "condition": {
            "secret": true
          },
          "source": k["source"]
        };
        player1["secret_condition_list"].push(cond);
      }
      filter_game_info["player1"] = player1;
    }
    return filter_game_info;
  }
  /*
   * 如果游戏结束,会更改game_info里的game_status['FINISHED'] = player();
   * 返回:胜利者player()或false(游戏未结束)或'tie'(平局)
   */
  IsFinished(game_info) {
    let finished = false;
    let winner, winner_serial_number;
    if (game_info["game_status"] !== undefined && game_info["game_status"]['FINISHED'] !== undefined) {
      //有胜者
      winner = game_info["game_status"]['FINISHED'];
      if (winner['id'] == game_info["player1"]['id']) {
        //胜利者为player1
        winner_serial_number = 1;
      } else {
        //胜利者为player2
        winner_serial_number = 2;
      }
      return winner;
    }
    if (game_info["player1"]["cute_value"] >= 40 && game_info["player2"]["cute_value"] < 40) {
      winner = game_info["player2"];
      winner_serial_number = 2;
      game_info["game_status"]['FINISHED'] = winner;
      return winner;
    }
    if (game_info["player2"]["cute_value"] >= 40 && game_info["player1"]["cute_value"] < 40) {
      winner = game_info["player1"];
      winner_serial_number = 1;
      game_info["game_status"]['FINISHED'] = winner;
      return winner;
    }
    //无胜利者
    //检查平局
    if ((game_info["player1"]["cute_value"] >= 40 && game_info["player2"]["cute_value"] >= 40) || game_info['turns'] > GameRules['MAXBattleTurns']) {
      return 'tie';
    }
    return false;
  }
};
/* return value1 <operand> value2 */
function operand_result(operand, value1, value2) {
  // 特殊值处理不经过operand
  let SpecialValue = [-1000, -999, 999, 1000];
  for (let i in SpecialValue) {
    if (SpecialValue[i] == value1 || value2 == SpecialValue[i]) {
      // 特殊值处理不经过operand
      return value1 == value2;
    }
  }
  if (operand == "=") {
    return value1 == value2;
  }
  if (operand == "<") {
    return value1 < value2;
  }
  if (operand == ">") {
    return value1 > value2;
  }
  if (operand == ">=") {
    return value1 >= value2;
  }
  if (operand == "<=") {
    return value1 <= value2;
  }
  return false;
}