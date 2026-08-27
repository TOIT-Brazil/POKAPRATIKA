import { app } from './app';
import { env } from './config/env';

app.listen(env.port, '0.0.0.0', () => {
  process.stdout.write(`PlayField backend escutando na porta ${env.port}\n`);
});
