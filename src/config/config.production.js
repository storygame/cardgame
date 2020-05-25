// default config
import fs from 'fs';
import https from 'https';

const options = {
  key: fs.readFileSync('./ssl/server.key'),
  cert: fs.readFileSync('./ssl/server.crt')
};
const app = (callback, port, host, think) => {
  let server = https.createServer(options, callback);
  server.listen(port, host);
  return server;
}

module.exports = {
  workers: 1, // 不要改成超过1的数字,多用户的socket交换全局变量会出错
  port: 8360,
  //支持https
  // createServer: app,
  //使用粘性会话，来确保给定客户端请求命中相同的 worker
  stickyCluster: true,
  WebSocketDebug: true,
  MatchTimeLimit: 1000 * 60 * 5, // 匹配超时时间
  weixinAppID: "wxc5afc98ee52d9005",
  weixinAppSecret: "64d8e81ecaec8fddf2c86b7339303d52",
  ManageMentCode: "zxf12W23Dwz294AZcs2dj23HUw98js1c",
  Errors: {
    1000: "缺少参数.",
    1001: '重复创建.',
    1002: "未能登录成功.",
    1003: "用户名或密码错误.",
    1007: "你选择了你未拥有的角色,请去商城购买.",
    1009: "角色信息非法.",
    1010: "你的玉石不足.",
    1011: "暂时无法找到对手.",
    1012: "期望一场已经开始的游戏但是不存在.",
    1013: "没有权限来访问资源.",
    1014: "请求超时.",
    1015: "玩家的状态异常.",
    1016: "在对战中出现了非法参数.",
    1017: "你的请求所附带的信息与你的socket不符合.",
    1018: "你只能与在线玩家聊天.",
    1019: "你想要添加的玩家不存在.",
    1020: "你请求了一个不存在的单人NPC数据.",
    1021: "你请求了一个不存在的剧情数据.",
    1022: "你请求了一个不存在的角色.",
    1023: "本次剧情无对战.",
    1024: "你请求选择卡牌,但是没有卡牌可供选择(单人对战结束时).",
    1025: "你的经验值不足,无法进入剧情.",
    1026: "你请求选择卡牌,但是你并未取得战斗胜利.",
    1027: "你请求了一个不存在的卡牌数据.",
    1028: "由于卡牌数量不足,无法生成卡包.",
    1029: "非法的卡牌数据.",
    1030: "牌库数量超出限制.",
    1031: "你的卡组数量已达上限.",
    1032: "太晚了,你的回合已经结束了.",
    1033: "你今天已经签到了.",
    1034: "你所请求的卡牌不存在.",
    //访问错误
    1004: "数据库操作异常,请稍后再试.",
    1005: "socket非法访问.",
    1006: "非法访问.",
    1008: "请求的数据不存在.",
    //微信接口出错
    2000: "微信登录异常,请重新登录",
    2001: "无法登录微信,请重新登录或联系客服.",
    // 游戏内容相关的错误
    // 1000: "One of arguments is undefined.",
    // 1001: 'Repeat creating.',
    // 1002: "Login info is not valid.",
    // 1003: "Login Info is wrong.",
    // 1007: "The role you choose is locked.",
    // 1009: "Role info is not valid.",
    // 1010: "You coins is not enough.",
    // 1011: "Can not find opponents.",
    // 1012: "Expected a game but not exist.",
    // 1013: "No login privilege to access resources.",
    // 1014: "Time out.",
    // 1015: "Unexpected game status for player.",
    // 1016: "Invalid parameters in battle action.",
    // 1017: "Your request is with a valid userid, and don't compare to your socket.",
    // 1018: "You can not chat with an offline user in websocket.",
    // 1019: "The user you want to join does not exist.",
    // 1020: "You asked for a valid monster data when adventure.",
    // 1021: "You asked for a valid chapter data when adventure.",
    // 1022: "You asked for nonexistent role.",
    // 1023: "Your chapter has no battle but you asked for one.",
    // 1024: "You asked for choosing card but no card can be choosen.",
    // 1025: "You don't satisty the exp limit of this adventure.",
    // 1026: "You asked for choosing card but you don't win in an adventure game.",
    // 1027: "You asked for an inexistent card.",
    // 1028: "Can not generate a card bag because of lacking of cards.",
    // 1029: "Invalid cards data.",
    // 1030: "The value of cards pool is too big.",
    // 1031: "You can not add more card strategy.",
    // 1032: "It is too late to end your turn because it has been over.",
    // 1033: "You have checkin today.",
    // 1034: "The card you asked doesn't exist.",
    //访问错误
    // 1004: "Occured error when operate database.",
    // 1005: "It is not websocket, forbidden visiting.",
    // 1006: "Wrong Method.",
    // 1008: "The data required does not exist.",
    //微信接口出错
    // 2000: "Can not get wexin openid by code and userinfo",
    // 2001: "One of arguments is lacked when wxLogin.",
  },
  GameRules: {
    //玩家PVP中能拥有的套牌数量上限
    MatchGameCardListValue: 5,
    //玩家PVP中套牌卡池卡牌数量上限
    MatchGameCardsPoolValue: 25,
    // 玩家的血量的初始默认值
    CuteValueDefault: 30,
    //玩家血量下限
    MinCuteValue: 0,
    //玩家的血量上限
    MaxCuteValue: 100,
    // 玩家的费用的初始默认值
    StarValueDefault: 0,
    //玩家的费用上限
    MaxStarValue: 10,
    //玩家护甲的初始默认值
    ProtectValueDefault: 0,
    //玩家的护甲上限
    MaxProtectValue: 300,
    // 手牌的初始
    CardsValueDefault: 4,
    //玩家的手牌上限
    MaxCardsValue: 8,
    // 卡池里牌的初始数量,也是卡池的上限
    CardsPoolValueDefault: 30,
    // 最大回合数
    MaxBattleTurns: 60,
    //玩家最大额外回合上限
    MaxExtraTurns: 3,
    // 每回合开始时抽牌几张
    DrawCardsPerTurn: 1,
    // 每回合开始时增加费用
    AddStarPerTurn: 1,
    //玩家的buff槽位上限
    MaxBuffNum: 5,
    //玩家的触发槽位上限
    MaxConditionNum: 5,
    //玩家的奥秘槽位上限
    MaxSecretNum: 5,
    //玩家最大回合时间(s)
    MaxTurnTime: 60
  }
};
