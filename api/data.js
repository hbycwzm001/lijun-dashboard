const fetch = require('node-fetch');

// 飞书应用凭证
const APP_ID = process.env.FEISHU_APP_ID || 'cli_aa0fc6251bb89bb5';
const APP_SECRET = process.env.FEISHU_APP_SECRET || 'lqRT0u62EKfmMeE4NCgDOfHxz8pmxSqm';
const BASE_TOKEN = 'UPpAb7ltjaTJzZsmriPc2RnCnDf';

// 表名到table_id的映射
const TABLE_MAP = {
  '账号管理': 'tblhsYy8UhYjDfow',
  '商品库': 'tblgYZibtHIwTTV6',
  '作品数据': 'tbldDB5V8a5GzxNs',
  '直播复盘': 'tblyQbQRUmatzMZD',
  '订单管理': 'tblJkuWQ0aiTHBJ5',
  '投流数据': 'tblghsN995yBB7AR',
  '财务记录': 'tblZhBFywlsX15Ag',
  '库存管理': 'tblfs6aO4luvfVlu',
  '客服退换货': 'tblVnep32zzsHh9M',
  '物流跟踪': 'tbly8mpNhSLWJiXv'
};

// 缓存token
let tokenCache = { token: null, expireAt: 0 };

async function getTenantAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expireAt - 60000) {
    return tokenCache.token;
  }
  
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error('获取token失败: ' + data.msg);
  }
  tokenCache = {
    token: data.tenant_access_token,
    expireAt: now + data.expire * 1000
  };
  return tokenCache.token;
}

async function getTableRecords(tableName, pageSize = 100) {
  const tableId = TABLE_MAP[tableName];
  if (!tableId) {
    throw new Error('未知的表名: ' + tableName);
  }
  
  const token = await getTenantAccessToken();
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records?page_size=${pageSize}`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error('读取数据失败: ' + data.msg);
  }
  
  // 转换记录格式，提取fields
  return data.data.items.map(item => item.fields);
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { table, all } = req.query;
    
    if (all === 'true') {
      // 返回所有表的汇总数据
      const result = {};
      for (const name of Object.keys(TABLE_MAP)) {
        try {
          result[name] = await getTableRecords(name, 50);
        } catch (e) {
          result[name] = { error: e.message };
        }
      }
      return res.status(200).json({ success: true, data: result });
    }
    
    if (!table) {
      return res.status(400).json({ success: false, error: '请指定table参数，可用表: ' + Object.keys(TABLE_MAP).join(', ') });
    }
    
    const records = await getTableRecords(table, 100);
    return res.status(200).json({ success: true, data: records, count: records.length });
    
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
