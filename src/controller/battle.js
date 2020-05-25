const Base = require('./base.js');
const Player = require('./player.js');
const Game = require('./game.js');
const Card = require('./card.js');
const Robot = require('./robot.js');
const Mail = require('./mail.js');
const Errors = think.config('Errors');

const ip = require('ip');
const host = ip.address();

var succ = function(datajson) {
  if (datajson === undefined) {
    return {
      'errno': 0,
      'errmsg': ''
    };
  } else {
    return {
      'errno': 0,
      'errmsg': '',
      'data': datajson
    };
  }
};
var fail = function(num, msg) {
  if (num === undefined) {
    num = 1;
  }
  if (msg === undefined) {
    msg = 'unknown error.';
  }
  return {
    'errno': num,
    'errmsg': msg
  };
};
//  let Errors = this.config('Errors');
var socketList = {};
var MatchList = {};
var MatchSuccess = {};
var GameList = {};
var UserSession = {};
const consoleSymbol = {
  "yes": "\u001b[0;32;40m[✓]\u001b[0m",
  "no": "\u001b[0;31;40m[✗]\u001b[0m",
  "info": "\u001b[1;34;40m[*]\u001b[0m"
};
module.exports = class extends Base {
  __before() {
    if (!this.isWebsocket) {
      return this.fail(1005, Errors['1005']);
    }
  }
  openAction() {
    //  成功建立连接返回Hello,服务器知道将要有一个client进行battle占用资源
    const socket = this.websocket;
    socketList[socket['id']] = socket['id'];
    // 记录当前 WebSocket 连接到的服务器ip
    //  console.log(socket.nsp.connected)
    socket.emit('openReply', succ('Hello'));
  }
  chatAction() {
    /*
     * paramaters: sender_id, receiver_id, message
     * 检查目标是否上线,若上线则发送消息并返回发送成功的信息,否则返回发送失败的信息
     * chatReply{id}返回信息succ({message:msg,sender_id:id})
     */
    const data = this.wsData;
    const socket = this.websocket;
    const sender_id = data["sender_id"];
    const receiver_id = data["receiver_id"];
    const message = data["message"];
    if (receiver_id == undefined) {
      return this.fail(1019, Errors["1019"]);
    }
    console.log(consoleSymbol["yes"] + " Info: User " + sender_id + " 向 " + receiver_id + " 发送:" + message);
    Mail.addChat(sender_id, receiver_id, message);
    //提醒已发送聊天内容,在线的会直接查看,不在线会等上线后查看
    socket.emit('chatReply' + sender_id, succ({
      "message": message,
      'sender_id': sender_id,
      "receiver_id": receiver_id
    }))
    //暂时不做实时提醒,由客户端轮询
    // return socket.to(receiver_socket).emit('chatReply' + receiver_id, succ({
    //   "message": message,
    //   'sender_id': sender_id,
    //   "receiver_id": receiver_id
    // }));
  }

  async chatWorldAction() {
    /*
     * paramaters: sender_id, receiver_id, message
     * 检查目标是否上线,若上线则发送消息并返回发送成功的信息,否则返回发送失败的信息
     * chatWorldReply返回信息succ({message:msg,sender_id:id,sender_name:sender_name})
     */
    const data = this.wsData;
    const socket = this.websocket;
    const sender_id = data["sender_id"];
    const message = data["message"];
    const sender_name = data["sender_name"];
    let player = think.model("player");
    let userinfo = await player.where({
      id: sender_id
    }).select();
    let avatar = "role1_avatar_png";
    if (userinfo.length == 1) {
      avatar = userinfo[0]["avatar"];
    }
    console.log("" + consoleSymbol["yes"] + " Info: User " + sender_name + "(" + sender_id + ") send : " + message);
    return this.broadcast('chatWorldReply', succ({
      'message': message,
      'sender_id': sender_id,
      "sender_name": sender_name,
      "sender_avatar": avatar
    }));
  }
  async resurgenceAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const username = data["username"];
    const password = data["password"];
    let logininfo, userid;
    logininfo = await Player.login(username, password);
    // this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+' LoginInfo ', logininfo);
    if (logininfo.errno === 0 && logininfo['data']['userinfo'] !== undefined) {
      userid = logininfo['data']['userinfo']['id'];
      if (UserSession[userid] === undefined) {
        UserSession[userid] = {
          'userinfo': logininfo['data']['userinfo']
        };
      }
      console.log(consoleSymbol["yes"] + " 用户<" + (logininfo['data']['userinfo']['nickname'] == "" ? logininfo['data']['userinfo']['username'] : logininfo['data']['userinfo']['nickname']) + ">注册socketList信息.");
      socketList[socket['id']] = logininfo['data']['userinfo'];
      this.config("WebSocketDebug") && console.log(consoleSymbol["info"] + " resurgence request by user: ", username + "(" + userid + ")");
      console.log("Now GameList:", GameList);
      // 如果GameList已经有一局游戏包含这个角色,那么返回游戏信息
      let isResurgence = false;
      let game_info = null,
        player = null;
      for (let g in GameList) {
        if (GameList[g]["player1"]["id"] == userid) {
          isResurgence = true;
          game_info = GameList[g];
          player = GameList[g]["player1"];
          break;
        }
        if (GameList[g]["player2"]["id"] == userid) {
          isResurgence = true;
          game_info = GameList[g];
          player = GameList[g]["player2"];
          break;
        }
      }
      if (game_info == null || player == null) {
        return null;
      }
      console.log("User(" + userid + ") login and need to be joined a game.");
      socket.emit('resurgenceReply' + userid, succ(Game.PlayerInfoFilter(game_info, player)));
    } else {
      return socket.emit('resurgenceReply', fail(1003, Errors['1003']));
    }
  }
  async matchAction() {
    const data = this.wsData;
    const socket = this.websocket;
    //  let iosocket = this.ctx.app.websocket;
    //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'SocketList :', socketList);
    //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'WsData', this.wsData);
    const roleid = data['roleid'];
    const username = data['username'];
    const password = data['password'];
    let userid = data['userid'];
    console.log(consoleSymbol["info"] + " <" + String(username) + "> match with role " + String(roleid));
    let LoginConfirm = false;
    let logininfo, roleBool;
    if (userid !== undefined) {
      // this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'UserId: ', userid);
      LoginConfirm = true;
      if (UserSession[userid] === undefined) {
        LoginConfirm = false;
      } else {
        logininfo = {
          'data': {
            'userinfo': UserSession[userid]['userinfo']
          }
        };
      }
    }
    if (LoginConfirm === false) {
      // check login
      logininfo = await Player.login(username, password);
      // this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' LoginInfo ', logininfo);
      if (logininfo.errno === 0 && logininfo['data']['userinfo'] !== undefined) {
        LoginConfirm = true;
        userid = logininfo['data']['userinfo']['id'];
      } else {
        return socket.emit('matchReply', fail(1003, Errors['1003']));
      }
    }
    if (LoginConfirm) {
      if (UserSession[userid] === undefined) {
        UserSession[userid] = {
          'userinfo': logininfo['data']['userinfo']
        };
      }
      UserSession[userid]['userinfo'] = logininfo['data']['userinfo'];
      // 记录socket_id对应的userinfo,方便该socket离线后清除session
      socketList[socket['id']] = logininfo['data']['userinfo'];
      //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'isActive', roleBool);
      // 检查active role.
      roleBool = await Player.isActive(userid, roleid);
      if (roleBool['errno'] !== 0) {
        return socket.emit('matchReply' + userid, fail(1007, Errors['1007']));
      }
      let roleInfo = roleBool["data"];

      // 生成 match的信息
      let p1 = {
        socket: socket['id'],
        id: userid,
        status: 0,
        skill: JSON.parse(roleInfo["skill"]),
        skill_description: roleInfo["skill_description"]
      };
      this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' MatchList Now: ', JSON.stringify(MatchList));
      this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' SuccessList Now: ', JSON.stringify(MatchSuccess));
      // 如果GameList已经有一局游戏包含这个角色,那么返回游戏信息
      for (let g in GameList) {
        if (GameList[g]["player1"]["id"] == p1["id"] || GameList[g]["player2"]["id"] == p1["id"]) {
          return socket.emit('matchReply' + p1['id'], succ(Game.PlayerInfoFilter(GameList[g], p1)));
        }
      }
      // 如果MatchSuccess中已经包含这个角色,返回匹配信息
      if (MatchSuccess[p1['id']] !== undefined) {
        const session = MatchSuccess[p1['id']]['session'];
        //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'Return Match Finished Info', GameList[session]);
        delete MatchSuccess[p1['id']];
        this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' Now MatchSuccess', MatchSuccess);
        if (!(GameList[session] === undefined)) {
          // 重复返回匹配成功的游戏信息
          // 这里Game.PlayerInfoFilter要求的p1只是为了过滤game_info,返回的是game_info里的player_info
          return socket.emit('matchReply' + p1['id'], succ(Game.PlayerInfoFilter(GameList[session], p1)));
        } else {
          // 如果游戏已经不存在,本次Match请求被视为一次信息匹配请求
          // 清除无效信息
          delete MatchSuccess[p1['id']];
        }
      }
      // 如果MatchList中已经包含这个角色,检查超时(返回匹配中错误)
      for (const i in MatchList) {
        if (i === p1['id']) {
          let MatchBeginTime = UserSession[userid]['BeginTime'];
          const nowTime = new Date().getTime();
          MatchBeginTime = parseInt(MatchBeginTime);
          if (isNaN(MatchBeginTime)) {
            // 客户端退出匹配又重新进来
            UserSession[userid]['BeginTime'] = new Date().getTime();
          }
          // this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+' Check Matach Time, begin: ' + MatchBeginTime + ' now: ' + nowTime + ' time: ' + (nowTime - MatchBeginTime));
          // 时间戳的差是以毫秒为单位的
          // 如果超时的话,返回超时信息并在MatchList中移除这个用户
          if (nowTime - MatchBeginTime > parseInt(this.config('MatchTimeLimit'))) {
            this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' Client ' + p1['id'] + 'TimeOut!');
            delete MatchList[p1['id']];
            socket.emit('matchReply' + p1['id'], fail(1014, Errors['1014']));
            return;
          }
          socket.emit('matchReply' + p1['id'], fail(1011, Errors['1011']));
          return;
        }
      }
      this.config('WebSocketDebug') && console.log(consoleSymbol["yes"] + ' Begin to Match for :', username);
      // 如果MatchList中没有这个匹配对象,并添加匹配时间
      const MatchBeginTime = new Date().getTime();
      UserSession[userid]['BeginTime'] = MatchBeginTime;
      MatchList[p1['id']] = p1;
      let opponent = MatchGame(p1);
      //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+' Find opponent: ', opponent['id']);
      if (opponent === false) {
        return socket.emit('matchReply' + p1['id'], fail(1011, Errors['1011']));
      }

      // 创建玩家信息和游戏信息
      p1 = Game.PlayerInfoInit(p1['id'], p1['socket'], p1);
      opponent = Game.PlayerInfoInit(opponent['id'], opponent['socket'], opponent);
      const oneGame = Game.GameInfoInit(p1, opponent);
      if (oneGame["condition"] == undefined) {
        console.log(consoleSymbol["no"] + ' Warning: GameInfo initialization occured errors. The condition is undefined but expected a empty list.');
      }
      const session = oneGame['session'];
      // console.log(consoleSymbol["yes"]+' Match Game Finished and allocate game_info for now game!');
      // 为对手记录匹配信息，对手下次轮询时获取信息
      MatchSuccess[opponent['id']] = {
        'opponent': p1['id'],
        'session': session
      };
      // 向GameList录入本次Game信息,防止
      GameList[session] = oneGame;
      // 向双方发送匹配成功的信息
      socket.emit('matchReply' + p1['id'], succ(Game.PlayerInfoFilter(oneGame, p1)));
      socket.to(opponent['socket']).emit('matchReply' + opponent['id'], succ(Game.PlayerInfoFilter(oneGame, opponent)));
      return null;
    }
  }
  async adventureGameAction() {
    const data = this.wsData;
    const socket = this.websocket;
    //  let iosocket = this.ctx.app.websocket;
    //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'SocketList :', socketList);
    //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+'WsData', this.wsData);
    //使用数据库信息来得到single_level,而不是参数,参数不安全
    const roleid = data['roleid'];
    const username = data['username'];
    const password = data['password'];
    let logininfo, userid, userinfo, roleBool;
    logininfo = await Player.login(username, password);
    // this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' LoginInfo ', logininfo);
    if (logininfo.errno === 0 && logininfo['data']['userinfo'] !== undefined) {
      userid = logininfo['data']['userinfo']['id'];
      userinfo = logininfo['data']['userinfo'];
      // 检查active role.
    } else {
      return socket.emit('adventureGameReply', fail(1003, Errors['1003']));
    }
    roleBool = await Player.isActive(userid, roleid);
    if (roleBool['errno'] !== 0) {
      return socket.emit('adventureGameReply' + userid, fail(1007, Errors['1007']));
    }
    let roleInfo = roleBool["data"];

    let p1 = {
      socket: socket['id'],
      id: userid,
      status: 2,
      skill: JSON.parse(roleInfo["skill"]),
      skill_description: roleInfo["skill_description"]
    };
    //如果玩家在MatchList,这是不应该发生的,将玩家移除
    for (let m in MatchList) {
      if (MatchList[m]["id"] == userid) {
        delete MatchList[m];
        console.log(consoleSymbol["no"] + " 冒险玩家仍在匹配列表中,移除玩家");
      }
    }
    //这里是重连部分,如果resurgence生效根本就不需要这一段，虽然这一段也不一定管用
    // 如果GameList已经有一局游戏包含这个角色,那么返回游戏信息
    // console.log(consoleSymbol["info"] + " 当前游戏列表", GameList);
    for (let g in GameList) {
      console.log(GameList[g]);
      if (GameList[g] == undefined) continue;
      if (GameList[g]["game_status"]["FINISHED"] != undefined) {
        //游戏列表出现了已经结束的游戏,移除它
        delete GameList[g];
      }
      if (GameList[g]["game_status"]["FINISHED"] == undefined && GameList[g]["player1"]["id"] == p1["id"]) {
        return socket.emit('adventureGameReply' + p1['id'], succ(Game.PlayerInfoFilter(GameList[g], p1)));
      }
    }


    //查询剧本的monster信息,为生成oppent的信息做准备
    let chap = Player.deLevel(userinfo["tmp_level"]);
    const section = chap[0];
    const level = chap[1];
    const chapter = this.model("chapter");
    let chapterInfo = await chapter.where({
      section: section,
      level: level
    }).select();
    if (chapterInfo.length != 1) {
      return socket.emit('adventureGameReply' + p1['id'], fail(1021, Errors['1021']));
    }
    if (chapterInfo[0]["isFight"] == 0) {
      return socket.emit('adventureGameReply' + p1['id'], fail(1023, Errors['1023']));
    }
    //如果玩家经验没有达到关卡限制经验,不允许进入
    if (chapterInfo[0]["expLimit"] > userinfo["exp"]) {
      return socket.emit('adventureGameReply' + p1['id'], fail(1025, Errors['1025']));
    }
    //否则一定有monster信息
    const monster = this.model("monster");
    let monster_id = parseInt(chapterInfo[0]["ai"]);
    let monster_info = await monster.where({
      id: monster_id
    }).select();

    if (monster_info.length != 1) {
      return socket.emit('adventureGameReply' + p1['id'], fail(1020, Errors['1020']));
    }


    //创建AI对手,id一定是0,一定是player2！！！
    let opponent = {
      socket: undefined,
      id: 0,
      status: 2,
      name: monster_info[0]["name"],
      skill: JSON.parse(monster_info[0]["skill"]),
      skill_description: JSON.parse(monster_info[0]["skill_description"]),
      type: monster_info[0]["type"],
    }



    // 创建玩家信息和游戏信息
    p1 = Game.PlayerInfoInit(p1['id'], p1['socket'], p1);
    opponent = Game.PlayerInfoInit(opponent['id'], opponent['socket'], opponent);
    //自己是player1,AI永远是p2
    let oneGame = Game.GameInfoInit(p1, opponent, "PVE");
    // 玩家永远是先手,AI永远是后手
    oneGame["now_turn"] = p1["id"];
    if (oneGame["condition"] == undefined) {
      console.log(consoleSymbol["no"] + ' Warning: GameInfo initialization occured errors. The condition is undefined but expected a empty list.');
      oneGame["condition"] = [];
    }
    let session = oneGame['session'];
    //根据level发牌,更改AI技能等
    oneGame['player1']['cards_pool'] = await Card.dealer(oneGame['player1']['cards_pool_value'], 1, oneGame['player1'], "adventure_player");
    oneGame['player2']['cards_pool'] = await Card.dealer(oneGame['player2']['cards_pool_value'], 2, oneGame['player2'], "adventure_ai");
    // console.log(consoleSymbol["no"] + " 玩家一发牌:", oneGame["player1"]["cards_pool"]);
    //设置玩家的cards_original_pool方便恢复牌库
    oneGame["player1"]["cards_original_pool"] = oneGame["player1"]["cards_pool"].concat();

    //提前部署ai的技能到player2的buff_list/condtion1/condtion2里
    oneGame = Game.useSkill(oneGame, oneGame['player2']);

    // 从牌库卡牌中挑选手牌,如果牌库数量都不够手牌数量,那直接全部给手牌,player2就是AI没有手牌
    if (oneGame["player1"]["cards_value"] > oneGame["player1"]["cards_pool"].length) {
      while (oneGame["player1"]["cards_pool"].length > 0) {
        let randomCard = oneGame["player1"]["cards_pool"].pop();
        oneGame["player1"]["cards_pool_value"]--;
        oneGame['player1']['cards_list'].push(randomCard);
      }
    } else {
      for (let i = 0; i < oneGame['player1']['cards_value']; i++) {
        let randomCard = oneGame["player1"]["cards_pool"].pop();
        oneGame["player1"]["cards_pool_value"]--;
        oneGame['player1']['cards_list'].push(randomCard);
      }
    }
    console.log(consoleSymbol["info"] + ' 玩家信息(单人模式):', p1);
    console.log(consoleSymbol["info"] + ' 怪物信息:', opponent);
    GameList[session] = oneGame;
    this.config('WebSocketDebug') && console.log(consoleSymbol["yes"] + ' It is ready for adventure.');
    this.config('WebSocketDebug') && console.log("GameList: ", GameList);
    //更新status并返回game_info
    p1["status"] = 3;
    opponent["status"] = 3;
    //自己是player1
    // this.emit('adventureGameReply' + p1['id'], succ(Game.PlayerInfoFilter(oneGame, oneGame['player1'])));
    //AI对你明牌
    this.emit('adventureGameReply' + p1['id'], succ(oneGame));
  }
  async readyGameAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const session = data['session'];
    const userid = data['userid'];
    let player, opponent;
    const NowGame = GameList[session];
    if (NowGame === undefined) {
      // 游戏不存在
      console.log(consoleSymbol["no"] + " 游戏session错误:" + session);
      console.log(consoleSymbol["info"] + " 当前游戏列表:", GameList);
      return socket.emit('readyGameReply' + userid, fail(1012, Errors['1012']));
    }
    this.config("WebSocketDebug") && console.log(consoleSymbol["info"] + " User " + userid + " visit readyGameAction.");
    if (userid === NowGame['player1']['id']) {
      player = NowGame['player1'];
      opponent = NowGame['player2'];
    } else if (userid === NowGame["player2"]["id"]) {
      player = NowGame['player2'];
      opponent = NowGame['player1'];
    }
    // 标记为player为准备状态
    if (player['status'] === 1) {
      player['status'] = 2;
    } else if (player['status'] === 2) {
      // 取消准备
      player['status'] = 1;
    }
    console.log(consoleSymbol["info"] + " 己方状态:", player, " 对方状态", opponent);

    this.config("WebSocketDebug") && console.log(consoleSymbol["info"] + " Player1(" + NowGame["player1"]["id"] + ") Status: " + NowGame["player2"]["status"] + ", Player2(" + NowGame["player2"]["id"] + ") Status: " + NowGame["player2"]["status"]);
    // 查看当前对局中的两个玩家是否均准备
    if (NowGame['player1']['status'] === 1) {
      const boolinfo = {
        'success': false
      };
      socket.emit('opponentReadyGameReply' + NowGame['player2']['id'], succ(boolinfo));
    }
    if (NowGame['player1']['status'] === 2) {
      const boolinfo = {
        'success': true
      };
      socket.emit('opponentReadyGameReply' + NowGame['player2']['id'], succ(boolinfo));
    }
    if (NowGame['player2']['status'] === 1) {
      const boolinfo = {
        'success': false
      };
      socket.emit('opponentReadyGameReply' + NowGame['player1']['id'], succ(boolinfo));
    }
    if (NowGame['player2']['status'] === 2) {
      const boolinfo = {
        'success': true
      };
      socket.emit('opponentReadyGameReply' + NowGame['player1']['id'], succ(boolinfo));
    }
    if (!(NowGame['player2']['status'] === 2 && NowGame['player1']['status'] === 2)) {
      return;
    }
    // 两个玩家均准备,可以开始游戏了

    if (NowGame['player1']['status'] === 2 && NowGame['player2']['status'] === 2) {
      // 随机生成牌库卡牌

      NowGame['player1']['cards_pool'] = await Card.dealer(NowGame['player1']['cards_pool_value'], 1, NowGame['player1'], "normal_random");
      NowGame['player2']['cards_pool'] = await Card.dealer(NowGame['player2']['cards_pool_value'], 2, NowGame['player2'], "normal_random");
      console.log(consoleSymbol["yes"] + ' 发牌完毕，玩家1有牌' + NowGame['player1']['cards_pool'].length + "张.");
      console.log(consoleSymbol["yes"] + ' 发牌完毕，玩家2有牌' + NowGame['player2']['cards_pool'].length + "张.");
      // 从牌库卡牌中挑选手牌
      for (let i = 0; i < NowGame['player1']['cards_value']; i++) {
        let randomCard = NowGame["player1"]["cards_pool"].pop();
        NowGame["player1"]["cards_pool_value"]--;
        NowGame['player1']['cards_list'].push(randomCard);
      }

      for (let i = 0; i < NowGame['player2']['cards_value']; i++) {
        let randomCard = NowGame["player2"]["cards_pool"].pop();
        NowGame["player2"]["cards_pool_value"]--;
        NowGame['player2']['cards_list'].push(randomCard);
      }
      this.config('WebSocketDebug') && console.log(consoleSymbol["yes"] + ' It is ready for game. Send ReadyGameReply to readyGameReply' + player['id'] + ' and readyGameReply' + opponent['id']);
      //  for (let i in NowGame) {
      //    if (i !== 'player1' && i !== 'player2' && i !== 'game_status') {
      //      console.log(i + ' : ', (NowGame[i]));
      //    }
      //  }
      //  console.log(NowGame['condition'], NowGame['condition'] === undefined);
      //  this.config('WebSocketDebug') && console.log(consoleSymbol["info"]+' Data: ', succ(Game.PlayerInfoFilter(NowGame, NowGame['player1'])));
      //更新player["status"]=3
      player["status"] = 3;
      opponent["status"] = 3;
      if (userid == NowGame["player1"]["id"]) {
        //自己是player1
        this.emit('readyGameReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, NowGame['player1'])));
        socket.to(opponent['socket']).emit('readyGameReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, NowGame['player2'])));
      } else if (userid == NowGame["player2"]["id"]) {
        //自己是player2
        this.emit('readyGameReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, NowGame['player2'])));
        socket.to(opponent['socket']).emit('readyGameReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, NowGame['player1'])));
      }
      return null;
    }
  }
  beginTurnAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const session = data['session'];
    const userid = data['userid'];
    let player, opponent;
    console.log("session: ", session);
    let NowGame = GameList[session];
    if (NowGame === undefined) {
      // 游戏不存在
      return socket.emit('beginTurnReply' + userid, fail(1012, Errors['1012']));
    }

    if (NowGame['player1']['id'] === userid) {
      player = NowGame['player1'];
      // playerSerialNumber = 1;
      opponent = NowGame['player2'];
    } else if (NowGame['player2']['id'] === userid) {
      player = NowGame['player2'];
      // playerSerialNumber = 2;
      opponent = NowGame['player1'];
    }
    if (NowGame['now_turn'] !== player['id']) {
      return socket.emit('beginTurnReply' + userid, fail(1016, Errors['1016']));
    }
    if (NowGame['game_status']['FINISHED'] === undefined) {
      NowGame['game_status']['RUNNING'] = player;
    } else {
      // 战斗已结束，向双方beginTurnReply返回对局结束错误
      socket.to(opponent['socket']).emit('beginTurnReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
      return socket.emit('beginTurnReply' + userid, succ(Game.PlayerInfoFilter(NowGame, player)));
    }
    // 结算beginTurn
    NowGame = Game.beginTurn(NowGame);

    console.log(consoleSymbol["yes"] + ' Begin Turn calculating done.');
    // console.log("=====================Game Info=====================");
    // for (const i in NowGame) {
    //   if (i !== "player1" && i !== "player2" && i !== "buff_list2")
    //     console.log(i, NowGame[i])
    // }
    // console.log("=====================PlayerInfo=====================");
    // for (const i in player) {
    //   if (i !== 'cards_pool' && i !== 'cards_list' && i !== 'draw_list' && i !== 'cards_original_pool') {
    //     console.log(i, player[i]);
    //   }
    // }
    // console.log("====================================================");
    if (NowGame["mode"] == "PVP") {
      NowGame["countdown"] = think.timeout(think.config("GameRules")["MaxTurnTime"]).then(() => {
        //强制进行回合结束
        NowGame = Game.endTurn(NowGame);
        console.log(consoleSymbol["yes"] + ' EndTurn calculating done.');
        socket.to(opponent['socket']).emit('endTurnReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
        socket.emit('endTurnReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, player)));
        clearTimeout(NowGame["countdown"]);
        NowGame["countdown"] = null;
      });
    }
    // 结算完毕向双方返回游戏结算结果
    socket.to(opponent['socket']).emit('beginTurnReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
    return socket.emit('beginTurnReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, player)));
  }
  useCardAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const session = data['session'];
    const userid = data['userid'];
    const cardIndex = data['card_index'];
    //cardIndex = -1表示玩家使用技能
    let player, opponent;

    let NowGame = GameList[session];
    /* ----------------------------------------------参数合法性检测----------------------------------------------------------------  */
    if (NowGame === undefined) {
      // 游戏不存在
      return socket.emit('useCardReply' + userid, fail(1012, Errors['1012']));
    }
    if (NowGame['player1']['id'] === userid) {
      player = NowGame['player1'];
      opponent = NowGame['player2'];
    } else if (NowGame['player2']['id'] === userid) {
      player = NowGame['player2'];
      opponent = NowGame['player1'];
    }
    if (NowGame['now_turn'] !== player['id']) {
      this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' Now turn is for user: ' + NowGame['now_turn'] + ', and player id is ', player['id']);
      return socket.emit('useCardReply' + userid, fail(1016, Errors['1016']));
    }
    if (cardIndex === undefined || isNaN(parseInt(cardIndex, 10))) {
      this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' You request a valid cardIndex: ', cardIndex);
      return socket.emit('useCardReply' + userid, fail(1016, Errors['1016']));
    } else {
      if (cardIndex >= player['cards_list'].length) {
        this.config('WebSocketDebug') && console.log(consoleSymbol["info"] + ' You request a valid cardIndex: ' + cardIndex + ' cards_value: ', player['cards_list'].length);
        return socket.emit('useCardReply' + userid, fail(1016, Errors['1016']));
      }
    }
    if (NowGame['game_status']['FINISHED'] === undefined) {
      NowGame['game_status']['RUNNING'] = player;
    } else {
      // 战斗已结束，向双方beginTurnReply返回对局结束错误
      socket.to(opponent['socket']).emit('useCardReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
      return socket.emit('useCardReply' + userid, succ(Game.PlayerInfoFilter(NowGame, player)));
    }
    /* ----------------------------------------------Done----------------------------------------------------------------  */
    // 根据使用的卡牌进行结算
    if (cardIndex != -1) {
      console.log(consoleSymbol["yes"] + 'Info: 玩家想要使用这张卡:\n', player['cards_list'][cardIndex]['description'], player['cards_list'][cardIndex]);
      NowGame = Game.useOneCard(NowGame, player, cardIndex);
    } else {
      //玩家使用技能
      console.log(consoleSymbol["yes"] + 'Info: 玩家想要使用技能:\n', player['skill_description'], player["skill"]);
      NowGame = Game.useSkill(NowGame, player);
    }
    console.log(consoleSymbol["yes"] + 'Info: UseCard calculating done.');
    // console.log("=====================GameInfo=====================");
    // for (const i in NowGame) {
    //   if (i != "player1" && i != "player2" && i != "game_status") {
    //     console.log(i, NowGame[i]);
    //   }
    // }
    // console.log("=====================PlayerInfo====================");
    // for (const i in player) {
    //   if (i !== 'cards_pool' && i !== 'cards_list' && i !== 'cards_original_pool') {
    //     console.log(i, player[i]);
    //   }
    // }
    // console.log("==================================================");
    // 结算完毕向双方返回游戏结算结果
    socket.to(opponent['socket']).emit('useCardReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
    return socket.emit('useCardReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, player)));
  }
  endTurnAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const session = data['session'];
    const userid = data['userid'];
    let player, opponent;
    let NowGame = GameList[session];
    /* ----------------------------------------------参数合法性检测----------------------------------------------------------------  */
    if (NowGame === undefined) {
      // 游戏不存在
      return socket.emit('endTurnReply' + userid, fail(1012, Errors['1012']));
    }
    if (NowGame['player1']['id'] === userid) {
      player = NowGame['player1'];
      // playerSerialNumber = 1;
      opponent = NowGame['player2'];
    } else if (NowGame['player2']['id'] === userid) {
      player = NowGame['player2'];
      // playerSerialNumber = 2;
      opponent = NowGame['player1'];
    }
    if (NowGame['now_turn'] !== player['id']) {
      return socket.emit('endTurnReply' + userid, fail(1016, Errors['1016']));
    }
    if (NowGame['game_status']['FINISHED'] === undefined) {
      NowGame['game_status']['RUNNING'] = player;
    } else {
      // 战斗已结束，向双方beginTurnReply返回game_info
      socket.to(opponent['socket']).emit('endTurnReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
      return socket.emit('endTurnReply' + userid, succ(Game.PlayerInfoFilter(NowGame, player)));
    }
    //检查本回合是否已经被计时器结束(PVP才有)
    if (NowGame["mode"] == "PVP") {
      if (NowGame["countdown"] == null) {
        //太晚了,你的回合已经结束了
        return socket.emit('endTurnReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, player)));
        // return socket.emit('endTurnReply' + player['id'], fail(1032,Errors['1032']));
      } else {
        //正常结束回合,关闭计时器
        clearTimeout(NowGame["countdown"]);
        NowGame["countdown"] = null;
      }
    }
    /* ----------------------------------------------Done----------------------------------------------------------------  */
    // 根据使用的卡牌进行结算
    NowGame = Game.endTurn(NowGame);

    console.log(consoleSymbol["yes"] + ' EndTurn calculating done.');
    // console.log("=====================PlayerInfo=====================");
    // for (const i in player) {
    //   if (i !== 'cards_pool' && i !== 'cards_list' && i != "draw_list" && i !== 'cards_original_pool' && i == 'buff_list') {
    //     console.log(i, player[i]);
    //   }
    //   if (i == 'buff_list') {
    //     console.log(i, player[i].length);
    //   }
    // }
    // console.log("====================================================");
    // 结算完毕向双方返回游戏结算结果

    socket.to(opponent['socket']).emit('endTurnReply' + opponent['id'], succ(Game.PlayerInfoFilter(NowGame, opponent)));
    socket.emit('endTurnReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, player)));

    //如果是冒险模式,调用AI进行出牌
    if (NowGame["mode"] == "PVE" && NowGame["player2"]["id"] == 0) {
      while (NowGame["now_turn"] == 0) {
        console.log(consoleSymbol['info'] + " It's turn for Monster:");
        //为AI调用beginTurn
        NowGame = Game.beginTurn(NowGame);

        // console.log("=====================After AI beginTurn Game Info=====================");
        // for (const i in NowGame) {
        //   if (i !== "player1")
        //     console.log(i, NowGame[i]);
        // }
        // console.log("====================================================");


        socket.emit('beginTurnReply' + userid, succ(Game.PlayerInfoFilter(NowGame, player)));
        //AI对你明牌
        // socket.emit('beginTurnReply' + userid, succ(NowGame));
        //得到AI出牌结果
        // let robot = new Robot(NowGame);
        // let robotStrategy = robot.run();
        // console.log(consoleSymbol["info"] + ' AI want to use cards:', robotStrategy);
        // for (let i in robotStrategy) {
        // NowGame = Game.useOneCard(NowGame, opponent, i);
        // socket.emit('useCardReply' + player['id'], succ(Game.PlayerInfoFilter(NowGame, player)));
        // AI对你明牌
        // socket.emit('useCardReply' + player['id'], succ(NowGame));
        // }
        console.log(consoleSymbol["info"] + " AI使用了技能:");
        for (let i = 0; i < NowGame["player2"]["skill_description"].length; i++) {
          console.log(NowGame["player2"]["skill_description"][i]);
        }
        // AI根据自己的级别去打出伤害
        // AI的级别对应伤害、护甲表
        let ai_ceil_num = [
          [5, 4],
          [6, 5],
          [8, 6],
          [10, 8]
        ];
        let ai_damage = 0;
        let ai_protect = 0;
        let limit = ai_ceil_num[0];
        if (NowGame["player2"]["type"] == "兵") {
          limit = ai_ceil_num[0];
        }
        if (NowGame["player2"]["type"] == "士") {
          limit = ai_ceil_num[1];
        }
        if (NowGame["player2"]["type"] == "相") {
          limit = ai_ceil_num[2];
        }
        if (NowGame["player2"]["type"] == "王") {
          limit = ai_ceil_num[3];
        }
        if (NowGame["player2"]["type"] == "玩家" || limit == ai_ceil_num[0] && NowGame["player2"]['type'] != "兵") {
          console.log(consoleSymbol["no"] + " 怪物级别标识出错！当前怪物类型:", NowGame["player2"]["type"]);
          limit = ai_ceil_num[0];
        }

        ai_damage = NowGame["player2"]["star_value"];
        ai_protect = NowGame["player2"]["star_value"];
        if (ai_damage > limit[0]) {
          ai_damage = limit[0];
        }
        if (ai_protect > limit[1]) {
          ai_protect = limit[1];
        }

        //50%概率打人,50%概率叠甲
        let hitplayer = Math.random() > 0.5;
        let protector = Math.random() > 0.5;
        // console.log(consoleSymbol["info"] + "是否打人:", hitplayer, "是否叠甲:", protector);
        let aiUseCard = {
          "pointer": 0,
          "card_cost": 0,
          "source": 2
        };
        if (!hitplayer || !protector) {
          if (hitplayer == true) {
            aiUseCard = {
              "pointer": 2,
              "damage": ai_damage,
              "card_cost": 0,
              "card_rare": "N",
              "source": 2
            }
            console.log(consoleSymbol["info"] + " 怪物使用了技能<打人" + ai_damage + ">");
          }
          if (protector == true) {
            aiUseCard = {
              "pointer": 1,
              "protect": ai_protect,
              "card_cost": 0,
              "card_rare": "N",
              "source": 2
            }
            console.log(consoleSymbol["info"] + " 怪物使用了技能<叠甲" + ai_protect + ">");
          }
        }
        if (protector && hitplayer) {
          aiUseCard = {
            "pointer": 1,
            "protect": ai_protect,
            "other_card_effect": {
              "pointer": 2,
              "damage": ai_damage,
              "card_cost": 0,
              "card_rare": "N"
            },
            "card_cost": 0,
            "card_rare": "N",
            "source": 2
          }
          console.log(consoleSymbol["info"] + " 怪物使用了技能<打人" + ai_damage + ">和<叠甲" + ai_protect + ">");
        }

        NowGame["player2"]["cards_list"].push({
          id: 0,
          effect: aiUseCard,
          name: "固定技能",
          card_cost: 0,
          card_rare: "N"
        });
        Game.useOneCard(NowGame, NowGame["player2"], 0);
        NowGame["player2"]["cards_list"] = [];
        // console.log("=====================AI Info=====================");
        // for (const i in NowGame["player2"]) {
        //   if (i !== 'cards_pool' && i !== 'cards_list' && i != "draw_list" && i !== 'cards_original_pool') {
        //     console.log(i, NowGame["player2"][i]);
        //   }
        //   if (i == 'buff_list') {
        //     console.log(i, NowGame["player2"][i].length);
        //   }
        // }
        // console.log("====================================================");
        //为AI调用endTurn
        NowGame = Game.endTurn(NowGame);
        socket.emit('endTurnReply' + userid, succ(Game.PlayerInfoFilter(NowGame, player)));
        //AI对你明牌
        // socket.emit('endTurnReply' + player['id'], succ(NowGame));
      }
    }
  }
  async closeGameAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const session = data['session'];
    const userid = data['userid'];
    const noFight = data["noFight"]; //1表示无对战剧情的结算,0表示正常结算
    console.log(consoleSymbol["info"] + " session:" + session + ", userid:" + userid + " noFight:" + noFight);
    if (noFight == 1 || noFight == "1") {
      //检查该玩家关卡是否无战斗(忽略)
      await Player.AdventureCheckOut(userid);
      return socket.emit('closeGameReply' + userid, succ({
        flag: 4
      }));
    }
    if (userid == undefined) {
      return socket.emit("closeGameReply" + userid, fail(1000, Error("1000")));
    }
    //1.无status,在匹配中,应该取消匹配
    if (session == undefined) {
      console.log(consoleSymbol["info"] + " 检查MatchList:", MatchList);
      for (let i in MatchList) {
        if (MatchList[i]["id"] === userid) {
          //移除该角色的匹配
          delete MatchList[i];
          console.log(consoleSymbol["info"] + " Info: 玩家" + userid + "取消匹配.");
          return socket.emit("closeGameReply" + userid, succ({
            "flag": 0
          }));
        }
      }
    }
    let player, opponent;
    let NowGame = GameList[session];
    /* ----------------------------------------------参数合法性检测----------------------------------------------------------------  */
    if (NowGame === undefined) {
      // 游戏不存在
      return socket.emit('closeGameReply' + userid, fail(1012, Errors['1012']));
    }
    if (NowGame['player1']['id'] === userid) {
      player = NowGame['player1'];
      opponent = NowGame['player2'];
    } else if (NowGame['player2']['id'] === userid) {
      player = NowGame['player2'];
      opponent = NowGame['player1'];
    }
    console.log(consoleSymbol["info"] + " 当前玩家status:", player["status"]);
    //2.status为1或2,匹配完成但未未进入游戏,在房间中,返回flag1,对手退出房间的
    if (player["status"] == 1 || player["status"] == 2) {
      //在GameList删除这个游戏信息,在MatchSuccess中删除匹配成功信息,并向对手发送退出房间信息
      delete GameList[session];
      for (let i in MatchSuccess) {
        if (MatchSuccess[player["id"]] != undefined) {
          delete MatchSuccess[player["id"]];
        }
        if (MatchSuccess[opponent["id"]] != undefined) {
          delete MatchSuccess[opponent["id"]];
        }
      }
      socket.to(opponent['socket']).emit('closeGameReply' + opponent['id'], succ({
        flag: 1
      }));
      return socket.emit('closeGameReply' + userid, succ({
        flag: 1
      }));
    }
    //3.status为3,在对战中,非意外退出（投降或胜利）
    if (player["status"] == 3) {
      let NowGameStatus = Game.IsFinished(NowGame);
      //若游戏未结束表示自己投降,返回flag3,删除对战信息,重新初始化game_info并返回
      let game_info;
      if (NowGameStatus == false || NowGameStatus == undefined) {
        //游戏结束,进行结束结算
        console.log(consoleSymbol["info"] + " 开始进行奖励结算(自己投降)");
        //你投降了,胜利者是对手
        await Game.GameFinishedReward(NowGame, opponent);
        if (NowGame["mode"] == "PVE") {
          //这里不能初始化,否则AI的技能会被初始化两次,应该在adventure里初始化
          delete GameList[NowGame["session"]];
        } else {
          let new_player1 = Game.PlayerInfoInit(player["id"], socket["id"], player);
          let new_player2 = Game.PlayerInfoInit(opponent["id"], socket["id"], opponent);
          game_info = Game.GameInfoInit(new_player1, new_player2);
          console.log(consoleSymbol["info"] + " 重置NowGame:", game_info);
          GameList[NowGame["session"]] = game_info;
        }
        socket.to(opponent['socket']).emit('closeGameReply' + opponent['id'], succ({
          flag: 3,
          game_info: game_info
        }));
        return socket.emit('closeGameReply' + userid, succ({
          flag: 3,
          game_info: game_info
        }));
      } else {
        //游戏结束,返回玩家正在进行的游戏已经结束，flag4,删除对战信息,重新初始化game_info并返回
        console.log(consoleSymbol["info"] + " 开始进行奖励结算(正常结束)");
        let NowGameStatus = Game.IsFinished(NowGame);
        await Game.GameFinishedReward(NowGame, NowGameStatus);
        if (NowGame["player2"]["id"] == 0) {
          //AI对局的话直接删除当前对局
          socket.emit('closeGameReply' + userid, succ({
            flag: 4,
            game_info: NowGame
          }));
          delete GameList[session];
          return;
        } else {
          let new_player1 = Game.PlayerInfoInit(player["id"], socket["id"], player);
          let new_player2 = Game.PlayerInfoInit(opponent["id"], socket["id"], opponent);
          let game_info = Game.GameInfoInit(new_player1, new_player2);
          console.log(consoleSymbol["info"] + " 重置game_info:", game_info);
          GameList[game_info["session"]] = game_info;
          socket.to(opponent['socket']).emit('closeGameReply' + opponent['id'], succ({
            flag: 4,
            game_info: game_info
          }));
          return socket.emit('closeGameReply' + userid, succ({
            flag: 4,
            game_info: game_info
          }));
        }
      }
    }
  }
  async chooseCardAction() {
    const data = this.wsData;
    const socket = this.websocket;
    const session = data['session'];
    const userid = data['userid'];
    const choice = parseInt(data["choice"]) || 10000; //玩家选择的卡

    let player = this.model("player");
    let userdata = await player.where({
      id: userid
    }).select();

    if (userdata.length != 1) {
      return socket.emit('chooseCardReply' + userid, fail(1002, Errors["1002"]));
    }
    let userinfo = userdata[0]
    let tmp_level = userinfo["tmp_level"];
    let chap = Player.deLevel(tmp_level);
    let chapter = this.model("chapter");
    let chapdata = await chapter.where({
      section: chap[0],
      level: chap[1]
    }).select();
    if (chapdata.length != 1) {
      return socket.emit('chooseCardReply' + userid, fail(1021, Errors["1021"]));
    }
    let isValid = false;
    for (let g in GameList) {
      if (GameList[g]["game_status"]["FINISHED"] != undefined && GameList[g]["game_status"]["FINISHED"]["id"] == userid) {
        console.log(consoleSymbol["yes"] + " 检测到玩家单人游戏胜利,进行3选1奖励", GameList[g]);
        isValid = true;
        break;
      }
    }
    if (!isValid) {
      return socket.emit('chooseCardReply' + userid, fail(1026, Errors["1026"]));
    }
    try {
      //这里不检查安全性,只检查该关卡是否有3选1,有的话直接添加tmp_collection
      let cardAward = JSON.parse(chapdata[0]["generalCardAward"]);
      if (cardAward.length == 0) {
        return socket.emit('chooseCardReply' + userid, fail(1024, Errors["1024"]));
      }
      if (cardAward[0] == "random") {
        let tmp_collection = JSON.parse(userinfo["tmp_collection"]);
        //添加选择的卡牌
        tmp_collection.push(choice);
        await player.where({
          id: userid
        }).update({
          tmp_collection: JSON.stringify(tmp_collection)
        });
      }
      return socket.emit('chooseCardReply' + userid, succ());
    } catch (e) {
      return socket.emit('chooseCardReply' + userid, fail(1021, Errors["1021"]));
    }
  }
  closeAction() {
    const socket = this.websocket;
    const userid = socketList[socket["id"]]["id"];
    if (userid !== undefined) {
      console.log(consoleSymbol["info"] + ' Info: 玩家: ' + userid + "退出了游戏.");
      delete UserSession[userid];
    } else {
      console.log(consoleSymbol["info"] + ' Info: 玩家:', socket["id"], "退出了游戏.(无userid记录)");
    }
    // 判断玩家是否有仍在对局中的游戏,删除游戏信息,并对其发出对手掉线的信号
    let opponent = null;
    let session = undefined;
    let NowGame = undefined;
    for (let g in GameList) {
      if (GameList[g]["player1"]["id"] == userid || GameList[g]["player2"]["id"] == userid) {
        NowGame = GameList[g];
        session = g;
        break;
      }
    }
    if (NowGame != undefined && session != undefined) {
      if (NowGame["game_status"]["FINISHED"] == undefined) {
        //存在未结束游戏,强行结束游戏(暂时重连不生效)
        if (NowGame["player1"]["id"] == userid) {
          opponent = NowGame["player2"];
        }
        if (NowGame["player2"]["id"] == userid) {
          opponent = NowGame["player1"];
        }
        console.log(consoleSymbol["info"] + ' Info: 结束玩家 ' + userid + "和玩家 " + opponent['id'] + " 正在进行的游戏.");
        socket.to(opponent['socket']).emit('closeGameReply' + opponent['id'], succ({
          "flag": 2
        }));
        delete GameList[session];
      }
    }
  }
};

function MatchGame(p) {
  // 你已经被匹配走了
  let leng = 0;
  let isMeIn = false;
  for (const i in MatchList) {
    leng++;
    if (MatchList[i]['id'] === p['id']) {
      isMeIn = true;
    }
  }

  if (leng === 0) {
    // 你的客户端应该已经收到消息了
    return false;
  }

  if (isMeIn === false) {
    // 你已经被匹配走了(在其他Websocket里)
    return false;
  }
  if (leng === 1 && MatchList[p['id']] !== undefined) {
    // 匹配队列只有一个人
    //  sleep.sleep(1);
    //  return MatchGame(p);
    return false;
  }
  // 匹配队列有不是你的玩家
  let opponent;
  // 找到匹配的对手,这里选择第一个遇到的不是自己的人为对手
  for (const i in MatchList) {
    if (MatchList[i]['id'] !== p['id']) {
      opponent = MatchList[i];
      break;
    }
  }
  console.log(consoleSymbol["yes"] + ' Match Cogratulation!', JSON.stringify(MatchList));
  // 把自己拿出来
  delete MatchList[p['id']];
  // 把对手拿出来
  delete MatchList[opponent['id']];
  return opponent;
}