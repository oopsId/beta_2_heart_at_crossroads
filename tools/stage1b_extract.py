from pathlib import Path
p=Path('heart_at_crossroads.html')
t=p.read_bytes().decode('utf-8')
a=t.find('    <'+'script>')
b=t.find('</'+'script>',a)
if a<0 or b<0: raise SystemExit('inline script not found')
start=a+len('    <'+'script>')
js=t[start:b]
if len(js)<50000: raise SystemExit('inline script unexpectedly small')
Path('assets/js/core-runtime.js').write_text(js,encoding='utf-8',newline='')
p.write_bytes((t[:a]+'    <script src="assets/js/core-runtime.js"></script>'+t[b+len('</'+'script>'):]).encode('utf-8'))
print(len(js))
