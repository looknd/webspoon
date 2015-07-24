#!/usr/bin/env node

import crypto from 'crypto';
import glob from 'glob';
import bfs from 'babel-fs';


/**
 * 主过程
**/

// 从输入参数中读入数据
Promise.resolve({ static: [], base: [] }).then(args => {
  [...process.argv].reduce((memo, value) => {
    if(value[0] !== '-') {
      if(!memo) return memo;
      memo.push(new Promise((resolve, reject) => {
        glob(value, (error, list) => error ? reject(error) : resolve(list));
      }));
      return memo;
    }
    switch(value) { 
      case '-static': return args.static;
      case '-base': return args.base;
      default: return null;
    }
  }, null);
  return Promise.all([
    Promise.all(args.base).then(list => [].concat(...list)),
    Promise.all(args.static).then(list => [].concat(...list))
  ]);
})

// 将 staticList 的文件重命名为带 hash 的
.then(([baseList, staticList]) => Promise.all([
  baseList,
  Promise.all(staticList.map(pathname => {
    // 此处不使用 Promise 扁平化是因为文件数据量可能很大，这样可以避免全部文件一起读入内存使内存占用过高
    return bfs.readFile(pathname).then(data => {
      var sha1 = crypto.createHash('sha1');
      sha1.update(data);
      var hash = sha1.digest('hex').slice(0, 6);
      var newPath = pathname.replace(/(?=[^.]*$)/, `${hash}.`);
      return bfs.rename(pathname, newPath).then(() => [pathname, newPath]);
    });
  }))
]))

// 将 baseList 中对 staticList 的引用更新到重命名 hash 后的版本，并写回文件
.then(([baseList, staticList]) => {
  // 将 staticList 中的旧路径转换成正则以便后续使用
  staticList.forEach(args => {
    args[0] = new RegExp('\\b' + args[0].replace(/\./g, '\\.') + '\\b', 'g');
  });
  baseList.map(pathname => {
    // 此处不使用 Promise 扁平化是因为文件数据量可能很大，这样可以避免全部文件一起读入内存使内存占用过高
    return bfs.readFile(pathname).then(data => {
      data = staticList.reduce((base, [oldPath, newPath]) => base.replace(oldPath, newPath), data + '');
      return bfs.writeFile(pathname, data);
    });
  });
})

// 成功
.then(() => {
  // TODO: OK
})

// 错误处理到 stderr
.catch(error => {
  process.stderr.write(`\x1b[31m${error.stack}\x1b[0m\n`);
  process.exit(1);
});