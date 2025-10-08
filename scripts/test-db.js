const db = require('../db');

async function run(){
  console.log('DB smoke test starting...');
  const o = await db.createOrder(null, { name: 'Unit Test Site', address: 'Test Address' }, ['item-a','item-b'], 'Test Driver');
  console.log('Order created:', o);
  const id = o.id;

  const s = await db.startDispatch(id, null, { 'vehicle_plate': 'TR-123' });
  console.log('Dispatch started:', s);

  const after = await db.getOrder(id);
  console.log('Order after start:', after);

  const c = await db.completeDispatch(id, null, { 'delivered_by': 'Alice' });
  console.log('Dispatch completed:', c);

  const final = await db.getOrder(id);
  console.log('Final order state:', final);

  // test return
  const r = await db.returnOrder(id, { reason: 'customer_return', note: 'Damaged item' });
  console.log('Order returned:', r);

  const afterReturn = await db.getOrder(id);
  console.log('Order after return:', afterReturn);
}

run().catch(err=>{ console.error('DB smoke test failed:', err); process.exit(1); });
