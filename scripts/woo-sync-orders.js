const { initializeDatabase } = require('../backend/src/config/database');
const { importWooOrderById, importWooOrders } = require('../backend/src/services/woo-order-importer');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await initializeDatabase();

  if (args['order-id']) {
    const result = await importWooOrderById(args['order-id'], {
      origin: 'woocommerce_cli',
      eventType: 'order.cli_import'
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await importWooOrders(
    {
      after: args['date-from'],
      before: args['date-to'],
      status: args.status,
      per_page: args['per-page'] || 50
    },
    {
      origin: 'woocommerce_cli',
      eventType: 'order.cli_backfill'
    }
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

