import sys,re,collections
rs={}
for l in open(sys.argv[2]+'/Unihan_IRGSources.txt',encoding='utf-8'):
    if '\tkRSUnicode\t' in l:
        cp,_,v=l.rstrip('\n').split('\t'); rs[chr(int(cp[2:],16))]=v.split()
def radnum(ch):
    for v in rs.get(ch,[]):
        r,s=v.split('.')
        if s=='0': return r.rstrip("'")
rows=[];bad=[];nores=[]
for line in open(sys.argv[1],encoding='utf-8'):
    g,n,*cards=line.split()
    for i,c in enumerate(cards,1):
        m=re.fullmatch(r'(.)(.)(\d+)/(\d+)',c); ch,rad,a,b=m.groups(); a,b=int(a),int(b)
        rows.append((g,int(n),i,ch,rad,a,b))
        vals=rs.get(ch,[]); rn=radnum(rad)
        if not any(v.split('.')[0].rstrip("'")==rn and int(v.split('.')[1])==a for v in vals):
            # residual-only match (radical classification differs)?
            ronly=any(int(v.split('.')[1])==a for v in vals)
            bad.append((g,n,i,ch,rad,a,b,' '.join(vals),'residual matches, radical differs' if ronly else 'NO MATCH'))
print('cards',len(rows)); print(collections.Counter((r[0],r[1]) for r in rows))
dups=[k for k,v in collections.Counter((r[0],r[3]) for r in rows).items() if v>1]; print('dups within grade',dups)
for b in bad: print(b)
