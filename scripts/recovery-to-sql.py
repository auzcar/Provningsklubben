"""Convert a private recovery-data.json to SQL, refusing overwritten output.
Only restores into an empty application schema. Does not connect to production.
"""
import json, pathlib, sys
source, target = map(pathlib.Path, sys.argv[1:])
data = json.loads(source.read_text())
columns = {'historical':['id','data'], 'tastings':['id','owner','status','title','date','data','token','version'], 'members':['session','user','name'], 'ratings':['session','user','sample','data']}
assert data['format'] == 1 and set(data['tables']) == set(columns)
def literal(value):
    if value is None: return 'NULL'
    if isinstance(value, (int, float)): return str(value)
    assert isinstance(value, str) and '\x00' not in value
    return "'" + value.replace("'", "''") + "'"
# A failed guard aborts execution before any application data is inserted.
# Plain INSERT also rejects conflicting primary keys; never REPLACE or UPSERT.
lines = ['CREATE TABLE _restore_guard (n INTEGER CHECK(n = 0));', 'INSERT INTO _restore_guard SELECT ' + ' + '.join('(SELECT COUNT(*) FROM '+t+')' for t in columns) + ';']
for table, fields in columns.items():
    for row in data['tables'][table]:
        assert set(row) == set(fields), (table, set(row))
        if 'data' in row: json.loads(row['data'])
        lines.append('INSERT INTO '+table+' ('+','.join('"'+f+'"' for f in fields)+') VALUES ('+','.join(literal(row[f]) for f in fields)+');')
lines += ['DROP TABLE _restore_guard;']
with target.open('x') as out: out.write('\n'.join(lines)+'\n')
print('Recovery SQL created; contains private data. Do not commit it.')
