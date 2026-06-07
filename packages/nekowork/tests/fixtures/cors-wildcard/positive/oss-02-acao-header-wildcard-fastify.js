const fastify = require('fastify')({ logger: true });
const { Pool } = require('pg');
let lastResponse = 'OK';

const pool = new Pool({
  user: 'application',
  host: 'localhost',
  database: 'ElectricityUsers',
  password: '123',
  port: 5432,
});

const castType = arg => {
  if (!isNaN(new Date(arg)) && typeof arg === 'string' && arg.includes('-')) {
    return `date '${arg}'`;
  } else if (!isNaN(parseInt(arg))) {
    return arg;
  } else {
    return `'${arg}'`;
  }
};

fastify.addHook('onRequest', (request, reply, done) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header(
    'Access-Control-Allow-Methods',
    'POST, GET, OPTIONS, DELETE, PUT'
  );
  reply.header(
    'Access-Control-Request-Headers',
    'X-PINGOTHER, Content-Type, Accept, Origin, Access-Control-Request-Method'
  );
  done();
});

fastify.get('/get_tables', async () => {
  const data = await pool.query('SELECT * FROM "GetTables"();');
  return data.rows;
});

fastify.get('/table:tableName', async request => {
  const table = request.query.tableName;
  const data = await pool.query(`SELECT * FROM ${table};`);
  return data.rows;
});

fastify.post('/update', async request => {
  const toUpdate = JSON.parse(request.body);
  lastResponse = 'OK';

  for (const record of toUpdate) {
    record.value = castType(record.value)
    try {
      await pool.query(`UPDATE "${record.table}"\
                      SET "${record.field}" = ${record.value}\
                      WHERE "${record.PK}" = ${record.id};`);
    } catch (e) {
      lastResponse = e.message;
    }
  }

  return 'OK';
});

fastify.get('/status', async () => {
  return lastResponse;
});

fastify.post('/delete', async request => {
  const toDelete = JSON.parse(request.body);
  lastResponse = 'OK';

  try {
    await pool.query(
      `DELETE FROM "${toDelete.table}" WHERE "${toDelete.field}" = ${toDelete.id};`
    );
  } catch (e) {
    lastResponse = e.message;
  }

  return lastResponse;
});

fastify.post('/insert', async request => {
  const rowData = JSON.parse(request.body);
  const toInsert = {};
  lastResponse = 'OK';

  Object.keys(rowData.fields).forEach(key => {
    toInsert[`"${key}"`] = castType(rowData.fields[key]);
  });

  try {
    await pool.query(`INSERT INTO "${rowData.table}" (${Object.keys(
      toInsert
    ).join(',')}) 
    VALUES (${Object.values(toInsert).join(',')});`);
  } catch (e) {
    lastResponse = e.message;
  }

  return lastResponse;
});

fastify.listen(4000, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`);
});
