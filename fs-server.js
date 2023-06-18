import path from 'path';
import fs from 'fs';
import url from 'url';
import http from 'http';
// import { createServer } from 'https';
// import { readFileSync } from 'fs';

import express from 'express';
import {mkdirp} from 'mkdirp';
import {rimraf} from 'rimraf';

//

const startFsServer = () => {
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), 'data', 'fs');
  fs.mkdirSync(dataPath, {
    recursive: true,
  });

  const app = express();
  app.all('*', async (req, res, next) => {
    const o = url.parse(req.url);
    const p = o.pathname.replace(/^\.{1,2}(?:\/|$)/g, '');
    const urlPath = path.join(dataPath, p);

    if (req.method === 'GET') {
      // check if directory/file, etc.
      const stats = await new Promise((accept, reject) => {
        fs.stat(urlPath, (err, stats) => {
          if (!err) {
            accept(stats);
          } else if (err.code === 'ENOENT') {
            accept(null);
          } else {
            reject(err);
          }
        });
      });
      if (stats) {
        if (stats.isDirectory()) {
          const files = await new Promise((accept, reject) => {
            fs.readdir(urlPath, (err, files) => {
              if (!err) {
                accept(files);
              } else {
                reject(err);
              }
            });
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
        } else if (stats.isFile()) {
          const rs = fs.createReadStream(urlPath);
          rs.on('error', err => {
            console.warn(err);
            res.statusCode = 500;
            res.end(err.stack);
          });
          rs.pipe(res);
        } else {
          res.statusCode = 400;
          res.end('not implemented');
        }
      } else {
        res.statusCode = 404;
        res.end('not found');
      }
    } else if (['PUT', 'POST'].includes(req.method)) {
      const dirpath = path.dirname(urlPath);
      await mkdirp(dirpath);

      const ws = fs.createWriteStream(urlPath);
      ws.on('error', err => {
        console.warn(err);
        res.statusCode = 500;
        res.end(err.stack);
      });
      ws.on('finish', () => {
        res.end();
      });
      req.pipe(ws);
    } else if (['DELETE'].includes(req.method)) {
      if (req.getHeader('x-force')) {
        await rimraf(p);
        res.end();
      } else {
        res.status(403);
        res.end();
      }
    } else {
      res.statusCode = 400;
      res.end('not implemented');
    }
  });

  // const server = createServer({
  //   cert: readFileSync('./certs-local/fullchain.pem'),
  //   key: readFileSync('./certs-local/privkey.pem')
  // });
  const server = http.createServer();
  server.on('request', app);

  const port = parseInt(process.env.PORT, 10) || 3333;
  const host = '0.0.0.0';
  server.listen(port, host);
  server.on('listening', () => {
    console.log(`ready on ${host}:${port}`);
  });
  server.on('error', (err) => {
    console.error('server error', err);
    throw err;
  });
};
startFsServer();