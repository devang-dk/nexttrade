import os, glob

BAD  = 'config.js"></script>`n<script src="assets/js/api.js">'
GOOD = 'config.js"></script>\r\n<script src="assets/js/api.js">'

for path in glob.glob(r'd:/CAREER/STOCK/frontend/*.html'):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if '`n' in content:
        fixed = content.replace(BAD, GOOD)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f'Fixed: {os.path.basename(path)}')
    else:
        print(f'OK:    {os.path.basename(path)}')
