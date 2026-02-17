const fs=require('fs');
const path=require('path');
const target=path.join('src','components','shop','CartSheet.tsx');
let text=fs.readFileSync(target,'utf8');
