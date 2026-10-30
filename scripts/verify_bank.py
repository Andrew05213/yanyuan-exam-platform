import json,math,itertools,collections
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
b=json.loads((ROOT/'public'/'bank.json').read_text())
allq=[]
for p in b['papers']:
    qs=[q for s in p['sections'] for z in s['blocks'] for q in z['questions']]
    assert len(qs)==p['count'] and sum(q['points'] for q in qs)==100
    assert [q['id'] for q in qs]==list(range(1,len(qs)+1))
    assert all(len(q['analysis'])>25 for q in qs)
    allq.extend(qs)
    print(p['id'],len(qs),'score',sum(q['points'] for q in qs),'keys',''.join(q['answer'] for q in qs))
assert len(allq)==95

# Independent numerical/enumerative checks of the mathematical answers.
assert np.allclose(np.polynomial.polynomial.polymul([5,-2,1],[13,-4,1]),[65,-46,26,-6,1])
assert abs(16*math.prod(math.cos(k*math.pi/15) for k in [1,2,4,8])+1)<1e-12
for u in [1j,-1,-1j]:assert abs(sum(u**k for k in range(2024)))<1e-10
assert len([(x,y) for x in range(4,100) for y in range(4,100) if 3*y+3*x>x*y])==20
sums=[a+c for a in range(1,100) for c in range(1,100) if 6*(a+c)==a*c]
assert max(sums)-min(sums)==25
cards=collections.deque(range(1,101))
while len(cards)>1:cards.popleft();cards.rotate(-1)
assert cards[0]==72
roots=np.roots([1,0,-30,56]);valid=[float(z.real) for z in roots if abs(z.imag)<1e-9 and 20-z.real**2>=0]
assert len(valid)==2 and all(20-s*s>1e-6 for s in valid)
g=np.array([2,3,1]);comp=2*np.polynomial.polynomial.polymul(g,g)-np.pad(3*g,(0,2))+np.array([1,0,0,0,0])
assert np.allclose(comp,[3,15,23,12,2])
triples=[(a,m,n) for a in range(-30,31) for m in range(1,100) for n in range(m) if m*n==18 and m+n==a*a]
assert triples==[(-3,6,3),(3,6,3)]
cyclic=[c for c in itertools.combinations(range(12),4) if all(((x+1)%12 not in c) for x in c)]
assert len(cyclic)==105
sol=[]
for k in range(-2,100):
    for x in {math.sqrt(k+2),-math.sqrt(k+2)}:
        if math.floor(x)==k:sol.append(x)
assert sorted(set(sol))==[-1.,math.sqrt(3),2.]
count=sum(1 for c in itertools.combinations(range(1,31),4) if all(y-x>1 for x,y in zip(c,c[1:])))
assert count==math.comb(27,4)
for t in np.r_[np.linspace(-20,-.05,400),np.linspace(.05,20,400)]:
    x=t-1;y=1+2/t
    assert abs((x*x+1)*(y*y+1)-(2*t*t+8/t**2))<1e-8
    assert (x*x+1)*(y*y+1)>=8-1e-8
print('PASS: structure, totals, keys, explanations, independent mathematical checks')
