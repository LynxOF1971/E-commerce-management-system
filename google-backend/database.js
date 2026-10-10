// Only fixed SQL emitted by the shared app handlers is accepted. No client SQL is executed.
export const SCHEMA={users:['id','username','name','role','hash','salt','roles'],sessions:['id','user_id','expires'],attempts:['id','count','until'],orders:['id','creator','status','data','version'],cases:['id','creator','data'],expenses:['id','date','data','creator','created','voided','import_key'],salaries:['id','date','data','creator','created','voided'],change_requests:['id','order_id','requester_id','status','data','pending_key'],product_types:['name','proof_required'],photos:['id','fileId','type']};
const PRIVATE=['users','sessions','attempts'];
function splitTop(s,separator){let depth=0,quote=false,start=0,out=[];for(let i=0;i<s.length;i++){if(s[i]==="'")quote=!quote;if(quote)continue;if(s[i]==='(')depth++;if(s[i]===')')depth--;if(!depth&&s.slice(i,i+separator.length)===separator){out.push(s.slice(start,i).trim());start=i+separator.length;i+=separator.length-1;}}out.push(s.slice(start).trim());return out;}
export class SheetDB{
 constructor(ss,props){this.ss=ss;this.props=props;this.cache={};this.dirty=new Set();this.original={};}
 rows(table){if(!SCHEMA[table])throw Error('Unknown table');if(!this.cache[table]){let rows;
 if(PRIVATE.includes(table)){const values=this.props.getProperties();rows=Object.keys(values).filter(k=>k.startsWith('row:'+table+':')).map(k=>JSON.parse(values[k]));this.original[table]=rows.map(r=>r.id);}
 else{const s=this.ss.getSheetByName('KDFY_'+table);if(!s)throw Error('Run initializeWorkspace first.');rows=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,12).getValues().filter(r=>r[0]).map(r=>JSON.parse(r.slice(2).join(''))):[];}
 this.cache[table]=rows;}return this.cache[table];}
 prepare(sql){const db=this;let args=[];return {bind(...a){args=a;return this},all(){return {results:db.execute(sql,args)}},first(){return db.execute(sql,args)[0]||null},run(){return {meta:{changes:db.execute(sql,args)}}},_sql:sql,get _args(){return args}};}
 batch(stmts){const cache=JSON.stringify(this.cache),dirty=new Set(this.dirty);try{return stmts.map(s=>s.run())}catch(e){this.cache=JSON.parse(cache);this.dirty=dirty;throw e}}
 value(x,args){x=x.trim();if(/^\$\d+$/.test(x))return args[Number(x.slice(1))];if(x==='NULL')return null;if(/^\d+$/.test(x))return Number(x);if(x.startsWith("'"))return x.slice(1,-1);throw Error('Unsupported SQL value '+x);}
 where(row,expr,args){if(!expr)return true;return splitTop(expr,' AND ').every(part=>{
 const exists=part.match(/^EXISTS \(SELECT 1 FROM (\w+) WHERE (.*)\)$/);if(exists)return this.rows(exists[1]).some(r=>this.where(r,exists[2],args));
 const json=part.match(/^json_extract\(data,'\$\.(\w+)'\)=(.+)$/);if(json)return JSON.parse(row.data)[json[1]]===this.value(json[2],args);
 const m=part.match(/^(\w+)(=|>)(.+)$/);if(!m)throw Error('Unsupported SQL predicate '+part);const v=this.value(m[3],args);return m[2]==='='?row[m[1]]===v:row[m[1]]>v;
 });}
 execute(sql,args){let n=0;sql=sql.replace(/\?/g,()=>'$'+n++);
 if(sql.startsWith('SELECT users.* FROM sessions JOIN')){const session=this.rows('sessions').find(r=>r.id===args[0]&&r.expires>args[1]);return session?this.rows('users').filter(r=>r.id===session.user_id):[];}
 if(sql.startsWith('INSERT INTO attempts ')){let r=this.rows('attempts').find(r=>r.id===args[0]);if(r){if(r.until<args[2]){r.count=1;r.until=args[1]}else r.count++}else {this.rows('attempts').push({id:args[0],count:1,until:args[1]})}this.dirty.add('attempts');return 1;}
 let m=sql.match(/^SELECT (.+?) FROM (\w+)(?: WHERE (.*?))?(?: ORDER BY (.*?))?(?: LIMIT (\d+))?$/);
 if(m){let rows=this.rows(m[2]).filter(r=>this.where(r,m[3],args));if(m[4]){if(m[4]==='rowid DESC')rows.reverse();else rows.sort((a,b)=>{for(const term of m[4].split(',')){const [col,dir]=term.trim().split(' ');const c=String(a[col]??'').localeCompare(String(b[col]??''));if(c)return dir==='DESC'?-c:c}return 0})}if(m[5])rows=rows.slice(0,Number(m[5]));return rows.map(r=>m[1]==='*'?{...r}:Object.fromEntries(m[1].split(',').map(k=>[k,r[k]])));}
 m=sql.match(/^DELETE FROM (\w+) WHERE (.*)$/);if(m){const rows=this.rows(m[1]);this.cache[m[1]]=rows.filter(r=>!this.where(r,m[2],args));this.dirty.add(m[1]);return rows.length-this.cache[m[1]].length;}
 m=sql.match(/^UPDATE (\w+) SET (.*?) WHERE (.*)$/);if(m){let changes=0;for(const row of this.rows(m[1]))if(this.where(row,m[3],args)){for(const assign of splitTop(m[2],',')){const [k,v]=assign.split('=');row[k]=v===k+'+1'?(row[k]||0)+1:this.value(v,args)}changes++}if(changes)this.dirty.add(m[1]);return changes;}
 m=sql.match(/^INSERT INTO (\w+)(?: \(([^)]+)\))? (.*)$/);if(m){const table=m[1],cols=m[2]?m[2].split(','):SCHEMA[table];let tail=m[3],values;
 if(tail.startsWith('SELECT ')){const match=tail.match(/^SELECT (.*?) WHERE (EXISTS .*)$/);if(!this.where({},match[2],args))return 0;values=splitTop(match[1],',');}
 else{const match=tail.match(/^VALUES \((.*?)\)(.*)$/);values=splitTop(match[1],',');tail=match[2];}
 const row={...(table==='orders'?{version:0}:{}),...(['expenses','salaries'].includes(table)?{voided:0}:{}),...Object.fromEntries(cols.map((k,i)=>[k,this.value(values[i],args)]))};
 const unique=table==='users'?['id','username']:table==='product_types'?['name']:table==='expenses'?['id','import_key']:table==='change_requests'?['id','pending_key']:['id'];
 for(const key of unique){if(row[key]==null)continue;const existing=this.rows(table).find(r=>r[key]===row[key]);if(existing){if(table==='expenses'&&key==='import_key'&&tail.includes('DO NOTHING'))return 0;if(table==='product_types'&&tail.includes('ON CONFLICT')){existing.proof_required=row.proof_required;this.dirty.add(table);return 1}throw Error('UNIQUE constraint failed');}}
 this.rows(table).push(row);this.dirty.add(table);return 1;
 }throw Error('Unsupported database operation');}
 commit(){const requests=[];for(const table of this.dirty){if(PRIVATE.includes(table))continue;const sheet=this.ss.getSheetByName('KDFY_'+table),records=this.rows(table);const rows=records.map(r=>{const json=JSON.stringify(r);if(json.length>400000)throw Error('Order history is too large.');const chunks=json.match(/[\s\S]{1,40000}/g)||[];const detail=r.data?JSON.parse(r.data):r;return {values:[r.id||r.name,detail.customer||detail.description||detail.employee||r.status||'',...chunks].map(v=>({userEnteredValue:{stringValue:String(v)}}))}});
 const count=Math.max(rows.length,sheet.getLastRow()-1,1);if(sheet.getMaxRows()<count+1)requests.push({appendDimension:{sheetId:sheet.getSheetId(),dimension:'ROWS',length:count+1-sheet.getMaxRows()}});
 requests.push({updateCells:{range:{sheetId:sheet.getSheetId(),startRowIndex:1,endRowIndex:count+1,startColumnIndex:0,endColumnIndex:12},rows,fields:'userEnteredValue'}});}
 if(requests.length)Sheets.Spreadsheets.batchUpdate({requests},this.ss.getId());
 for(const table of this.dirty)if(PRIVATE.includes(table)){let rows=this.rows(table);if(table==='sessions')rows=rows.filter(r=>r.expires>Date.now());if(table==='attempts')rows=rows.filter(r=>r.until>Date.now());const ids=new Set(rows.map(r=>r.id));for(const id of this.original[table]||[])if(!ids.has(id))this.props.deleteProperty('row:'+table+':'+id);for(const row of rows)this.props.setProperty('row:'+table+':'+row.id,JSON.stringify(row));}
 this.dirty.clear();}
}
