// ========== 玄学工具数据与算法模块 ==========
// 设计理念（照搬原插件 astrbot_plugin_divination）：插件出数据，AI 出灵魂。
// 本模块只负责机械的抽牌 / 起课 / 查表，返回结构化数据；解读全部交给 X 用人格来说。
// 完全自包含，仅依赖 lunar-javascript（项目已装，用于小六壬农历换算）。

// =============================================================
// 一、塔罗牌库（78 张固定：22 张大阿卡纳 + 56 张小阿卡纳）
// meaning 为该牌的通用牌义关键词，供 X 解读时参考，不写死解读文本。
// =============================================================

// 大阿卡纳 22 张
const MAJOR_ARCANA = [
  { name: '愚者', upright: '新的开始、冒险、纯真、自由', reversed: '鲁莽、逃避、盲目、不切实际' },
  { name: '魔术师', upright: '创造力、主动、资源俱备、行动力', reversed: '欺骗、能力未用、犹豫、操弄' },
  { name: '女祭司', upright: '直觉、潜意识、神秘、内在智慧', reversed: '压抑直觉、秘密、表里不一' },
  { name: '皇后', upright: '丰饶、母性、感官、滋养、创造', reversed: '依赖、空虚、过度保护、创造受阻' },
  { name: '皇帝', upright: '权威、秩序、稳定、掌控、责任', reversed: '专制、僵化、失控、固执' },
  { name: '教皇', upright: '传统、信仰、指引、精神导师', reversed: '叛逆、教条、盲从、束缚' },
  { name: '恋人', upright: '爱情、结合、抉择、和谐', reversed: '失衡、分歧、错误选择、诱惑' },
  { name: '战车', upright: '意志、胜利、前进、掌控方向', reversed: '失控、方向迷失、冲动、受阻' },
  { name: '力量', upright: '勇气、内在力量、温柔的坚定、耐心', reversed: '软弱、自我怀疑、失去理智' },
  { name: '隐者', upright: '内省、寻求真理、独处、指引', reversed: '孤立、逃避、固执己见' },
  { name: '命运之轮', upright: '转机、循环、机遇、命运转动', reversed: '厄运、停滞、抗拒变化' },
  { name: '正义', upright: '公正、平衡、因果、责任', reversed: '不公、失衡、逃避责任' },
  { name: '倒吊人', upright: '牺牲、换位思考、放下、等待', reversed: '徒劳的牺牲、拖延、固执' },
  { name: '死神', upright: '结束、转变、重生、放下过去', reversed: '抗拒改变、停滞、无法放手' },
  { name: '节制', upright: '平衡、调和、耐心、中庸', reversed: '失衡、极端、缺乏耐心' },
  { name: '恶魔', upright: '欲望、束缚、执着、诱惑', reversed: '挣脱束缚、觉醒、释放' },
  { name: '塔', upright: '突变、崩塌、觉醒、旧结构瓦解', reversed: '避免灾难、缓慢的崩解、恐惧改变' },
  { name: '星星', upright: '希望、灵感、疗愈、宁静', reversed: '失望、信心动摇、迷茫' },
  { name: '月亮', upright: '潜意识、幻象、不安、直觉', reversed: '走出迷雾、释放恐惧、真相渐明' },
  { name: '太阳', upright: '喜悦、成功、活力、光明', reversed: '暂时的低落、过度乐观、延迟的成功' },
  { name: '审判', upright: '觉醒、重生、召唤、宽恕', reversed: '自我怀疑、逃避审视、悔恨' },
  { name: '世界', upright: '圆满、完成、整合、成就', reversed: '未完成、停滞、缺憾' },
]

// 小阿卡纳四花色，每花色 14 张（1-10 + 侍从/骑士/皇后/国王）
const SUIT_INFO = {
  权杖: { theme: '行动、激情、事业、能量', court: '热情行动' },
  圣杯: { theme: '情感、爱、关系、直觉', court: '情感关系' },
  宝剑: { theme: '思想、冲突、决断、真相', court: '理智沟通' },
  星币: { theme: '物质、金钱、工作、现实', court: '务实稳健' },
}
const RANKS = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍从', '骑士', '皇后', '国王']

// 生成小阿卡纳 56 张（牌义用花色主题 + 牌阶做通用描述，供 X 发挥）
function buildMinorArcana() {
  const cards = []
  for (const suit of Object.keys(SUIT_INFO)) {
    const info = SUIT_INFO[suit]
    for (const rank of RANKS) {
      cards.push({
        name: `${suit}${rank}`,
        upright: `${info.theme}（${rank}）——顺势、正面的能量流动`,
        reversed: `${info.theme}（${rank}）——受阻、失衡或需调整`,
      })
    }
  }
  return cards
}

const TAROT_DECK = [...MAJOR_ARCANA, ...buildMinorArcana()] // 共 78 张

// 默认牌阵库（可被 kv 键 tarot_spreads 覆盖扩充）
const DEFAULT_SPREADS = [
  { id: 'three', name: '三张牌阵', scope: '过去现在未来、事情发展脉络等开放性问题', positions: ['过去', '现在', '未来'] },
  { id: 'single', name: '单张指引', scope: '每日一句点拨、求一个方向', positions: ['指引'] },
  { id: 'yes_no', name: '是否牌阵', scope: '是非决策（正位=是，逆位=否）', positions: ['答案'] },
  { id: 'two', name: '二选一', scope: '在 A/B 两个选项间抉择', positions: ['选项A', '选项B'] },
  { id: 'relationship', name: '关系牌阵', scope: '感情/两人关系状态与走向', positions: ['你', '我', '关系现状', '走向'] },
]

// 洗牌：Fisher-Yates；从整副牌里不重复抽 n 张，每张随机正逆位
function drawCards(deck, n) {
  const pool = deck.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n).map(card => {
    const reversed = Math.random() < 0.5
    return { name: card.name, reversed, meaning: reversed ? card.reversed : card.upright }
  })
}

// 塔罗抽牌：按牌阵定义抽对应数量的牌，返回结构化数据（不写解读）
function castTarot(question, spread) {
  const positions = Array.isArray(spread?.positions) && spread.positions.length > 0
    ? spread.positions
    : ['指引']
  const drawn = drawCards(TAROT_DECK, positions.length)
  const cards = positions.map((position, i) => ({
    position,
    name: drawn[i].name,
    reversed: drawn[i].reversed,
    orientation: drawn[i].reversed ? '逆位' : '正位',
    meaning: drawn[i].meaning,
  }))
  return { spread: spread?.id || 'single', spreadName: spread?.name || '单张指引', question, cards }
}

// =============================================================
// 二、每日运势（同一天同星座结果一致：用 星座+日期 做确定性种子）
// =============================================================

const ZODIAC_ALIASES = {
  白羊: '白羊座', 金牛: '金牛座', 双子: '双子座', 巨蟹: '巨蟹座',
  狮子: '狮子座', 处女: '处女座', 天秤: '天秤座', 天蝎: '天蝎座',
  射手: '射手座', 摩羯: '摩羯座', 水瓶: '水瓶座', 双鱼: '双鱼座',
}
const LUCKY_COLORS = ['珊瑚红', '雾霾蓝', '奶油白', '暖橘', '薄荷绿', '藕粉', '象牙黄', '深空灰', '樱花粉', '午夜蓝']

// 简单确定性哈希：把字符串转成一个正整数种子
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// 基于种子的伪随机（线性同余），保证同种子同结果
function seededRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return s / 4294967296
  }
}

function normalizeZodiac(sign) {
  const s = String(sign || '').replace(/座$/, '').trim()
  return ZODIAC_ALIASES[s] || (s ? s + '座' : '未知星座')
}

// 计算今日运势：返回五维评分 + 幸运色 + 幸运数字（同日同星座恒定）
function getDailyFortune(sign, dateStr) {
  const zodiac = normalizeZodiac(sign)
  const day = dateStr || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0]
  const rand = seededRandom(hashString(`${zodiac}-${day}`))
  const star = () => 1 + Math.floor(rand() * 5) // 1-5 星
  return {
    zodiac,
    date: day,
    love: star(),
    wealth: star(),
    study: star(),
    health: star(),
    overall: star(),
    luckyColor: LUCKY_COLORS[Math.floor(rand() * LUCKY_COLORS.length)],
    luckyNumber: Math.floor(rand() * 9) + 1,
  }
}

// =============================================================
// 三、周公解梦（关键词词典查表；命中返回传统释义，未命中让 X 自由发挥）
// =============================================================

const DREAM_DICT = {
  蛇: '梦蛇多主变化与欲望，或有小人、或有情缘暗涌；蛇亦象征智慧与蜕变。',
  水: '水主财与情绪。清水吉、浊水忧；大水漫涨常表压力或情感翻涌。',
  火: '火主运势与心绪。旺火主兴旺激情，失火则防急躁与损耗。',
  牙齿: '梦掉牙，传统主亲人健康或人际变动，亦常表焦虑与失控感。',
  飞: '梦飞多主追求自由、渴望突破现状；飞得畅快主顺遂，坠落则防受挫。',
  坠落: '坠落多表不安全感、失控或对现状的担忧，提醒稳住节奏。',
  哭: '梦哭常为情绪宣泄，传统反主吉、忧尽转喜；亦表内心压抑需疏解。',
  笑: '梦笑主心境舒畅，人际和顺；若无端而笑则提醒莫得意忘形。',
  死亡: '梦死亡多主结束与重生，旧事将了、新局将开，未必是凶兆。',
  怀孕: '主新的开始、孕育计划或创造力萌发，亦表内心期待。',
  结婚: '梦婚主结合与承诺，或表对关系的期待；亦可能是新阶段的开启。',
  考试: '梦考试多表压力、被评判的焦虑，或对自我能力的检视。',
  追赶: '被追赶多表逃避某种压力或情绪；追赶他人则主目标与执着。',
  房子: '房子象征自我与内心。宽敞明亮主安稳，破败则表心力交瘁。',
  钱: '梦得钱财，传统主运势流动；失钱则防破财或情感消耗。',
  猫: '猫主灵性、独立与隐秘情感，亦象征身边亲近而神秘的人。',
  狗: '狗主忠诚与友谊，友善之犬主贵人，凶犬则防口舌与背叛。',
  鱼: '鱼谐音「余」，多主财与机遇；群鱼游动主顺遂丰足。',
  血: '血主精力与情感投入，亦可能表损耗；见血未必凶，常主变动。',
  火车: '火车主人生进程与既定轨道，赶车主机遇，误车则防错失。',
  雨: '雨主情绪与洗涤。细雨主柔情舒缓，暴雨则表情绪激荡。',
  桥: '桥主过渡与联结，过桥顺利主转机达成，桥断则防阻碍。',
  路: '路主前程与选择。宽路主坦途，岔路则表面临抉择。',
  山: '山主目标与阻力，登山主奋进，山高难越则表压力。',
  头发: '头发主健康与形象，掉发多表焦虑或精力损耗；理发则主除旧更新。',
  婴儿: '婴儿主新生、纯真与新计划，亦表需要被照顾的内在。',
  老人: '梦见老人多主智慧指引或长辈牵挂，亦表对经验的渴求。',
  镜子: '镜子主自我审视，照见真实的自己；镜碎则防关系裂痕。',
  门: '门主机会与选择，开门主新机来临，闭门则表受阻或抗拒。',
  海: '海主辽阔的情感与潜意识，平静主内心安宁，风浪则表情绪翻涌。',
  月亮: '月主阴柔、情感与直觉，圆月主圆满，残月则表牵挂或失落。',
  太阳: '太阳主活力、希望与阳性能量，多为吉兆，主前途光明。',
  花: '花主情感与美好，盛开主喜事与桃花，凋零则表遗憾。',
  树: '树主生命力与根基，枝繁叶茂主兴旺，枯木则表停滞。',
  鸟: '鸟主自由与消息，鸣叫主佳音，笼中鸟则表束缚。',
  车祸: '多表对失控与意外的恐惧，提醒放缓节奏、注意身边风险。',
  迷路: '迷路多表方向感缺失、内心迷茫，提醒重新厘清目标。',
  裸体: '裸体多表脆弱、被审视的不安，或渴望真实坦诚。',
  电梯: '电梯主境遇的起落，上升主进展，下坠或困住则表焦虑。',
  钥匙: '钥匙主解决之道与机会，得钥匙主难题将解。',
  书: '书主知识、答案与内省，读书主求解，找不到书则表困惑。',
}

function interpretDream(keyword) {
  const kw = String(keyword || '').trim()
  // 优先精确命中，其次做包含匹配（如「梦到大蛇」匹配「蛇」）
  if (DREAM_DICT[kw]) return { keyword: kw, matched: true, text: DREAM_DICT[kw] }
  for (const key of Object.keys(DREAM_DICT)) {
    if (kw.includes(key)) return { keyword: key, matched: true, text: DREAM_DICT[key] }
  }
  return { keyword: kw, matched: false, text: '' }
}

// =============================================================
// 四、小六壬（复用 lunar-javascript 农历换算 + 三步递推）
// 六宫顺序：大安→留连→速喜→赤口→小吉→空亡（索引 0-5）
// 口诀：大安起正月，月上起日，日上起时（用农历月/日/时辰）
// =============================================================

const LIUREN_PALACES = [
  { name: '大安', luck: '吉', verse: '静守即吉，宜稳不宜动' },
  { name: '留连', luck: '凶', verse: '拖延纠缠，急不得' },
  { name: '速喜', luck: '吉', verse: '喜事速至，趁热打铁' },
  { name: '赤口', luck: '凶', verse: '口舌是非，防争执' },
  { name: '小吉', luck: '吉', verse: '小成小就，得人助' },
  { name: '空亡', luck: '凶', verse: '事多虚耗，防落空' },
]

// 由小时数换算时辰序号：子时=1（23:00-01:00）、丑=2 … 亥=12
function hourToShichenIndex(hour) {
  // 子时跨 23:00-01:00：23 点及以后、以及 0 点属子时
  return (Math.floor((hour + 1) / 2) % 12) + 1
}

// 小六壬起课：默认用当前北京时间，也可传入指定时间
function castLiuren(question, date) {
  const { Solar } = require('lunar-javascript')
  // 统一到北京时间，再用 UTC 取值拿到"北京时钟"的年月日时，避免服务器本地时区干扰
  const base = date instanceof Date ? date : new Date()
  const beijing = new Date(base.getTime() + 8 * 60 * 60 * 1000)
  const y = beijing.getUTCFullYear()
  const mo = beijing.getUTCMonth() + 1
  const d = beijing.getUTCDate()
  const h = beijing.getUTCHours()
  const mi = beijing.getUTCMinutes()

  const solar = Solar.fromYmdHms(y, mo, d, h, mi, 0)
  const lunar = solar.getLunar()
  const lunarMonth = Math.abs(lunar.getMonth()) // 闰月为负，取绝对值当作对应月
  const lunarDay = lunar.getDay()
  const shichen = hourToShichenIndex(h)

  // 三步递推（纯整数运算）
  const monthPalace = (lunarMonth - 1) % 6
  const dayPalace = (monthPalace + lunarDay - 1) % 6
  const timePalace = (dayPalace + shichen - 1) % 6

  const palace = LIUREN_PALACES[timePalace]
  return {
    question,
    lunar: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getTimeZhi()}时`,
    palace: palace.name,
    luck: palace.luck,
    verse: palace.verse,
  }
}

module.exports = {
  TAROT_DECK,
  DEFAULT_SPREADS,
  castTarot,
  getDailyFortune,
  normalizeZodiac,
  interpretDream,
  DREAM_DICT,
  castLiuren,
  LIUREN_PALACES,
  hourToShichenIndex,
}
