"""Report public policy changes for editorial review without publishing eligibility rules."""
import concurrent.futures
import hashlib
import json
import os
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

class NoticePage(HTMLParser):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.href = None
        self.title = []
        self.links = set()
        self.text = []
        self.hidden = False

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.hidden = True
        if tag == 'a':
            self.href = dict(attrs).get('href')
            self.title = []

    def handle_data(self, data):
        if self.hidden:
            return
        self.text.extend(data.split())
        if self.href:
            self.title.append(data)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = False
        if tag == 'a' and self.href:
            title = ' '.join(''.join(self.title).split())
            link = urljoin(self.url, self.href)
            if '保送' in title and link.startswith(('https://', 'http://')):
                self.links.add(title + ' ' + link)
            self.href = None

def inspect(entry):
    key, url = entry
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'Hezhi-Admissions-Source-Check/1.0'})
        with urllib.request.urlopen(request, timeout=18) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise ValueError('page exceeds size limit')
            parser = NoticePage(response.url)
            hinted = response.headers.get_content_charset()
            encoding = hinted or ('gb18030' if b'charset=gb' in raw[:5000].lower() else 'utf-8')
            parser.feed(raw.decode(encoding))
        if len(''.join(parser.text)) < 30:
            raise ValueError('insufficient readable text')
        body = '\n'.join(sorted(parser.links)) if key.endswith('/index') and parser.links else ' '.join(parser.text)
        return key, {'source': url, 'sha256': hashlib.sha256(body.encode()).hexdigest(), 'notices': sorted(parser.links)}
    except Exception as error:
        return key, {'source': url, 'error': str(error)}

def main():
    directory = json.loads(Path('content/admissions-directories.json').read_text())
    schools = json.loads(Path('public/schools.json').read_text())['schools']
    entries = [(k+'/index', v) for k,v in directory.items()]
    entries += [(s['id']+'/notice', s['sourceUrl']) for s in schools]
    national = json.loads(Path('content/admissions-national.json').read_text())
    entries += [(s['id']+'/notice',s['source']) for s in national if s['detail']]
    entries.append(('national/index', 'https://gaokao.chsi.com.cn/zzbm/bssbm/'))
    snapshot = Path(sys.argv[1])
    old = json.loads(snapshot.read_text()) if snapshot.exists() else {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results = dict(pool.map(inspect, entries))
    summary = []
    for key, result in sorted(results.items()):
        previous = old.get(key)
        if 'error' in result:
            status = '读取失败，保留既有快照'
        else:
            status = '首次记录' if not previous else '待人工核验' if previous != result else '无变化'
            old[key] = result
        summary.append(f"{key} · {status} · {result['source']}")
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_text(json.dumps(old, ensure_ascii=False, indent=2))
    snapshot.with_suffix('.report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    report = '\n\n'.join(summary)
    print(report)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            print(report,file=output)
    return int(any('error' in r for r in results.values()))

if __name__ == '__main__':
    sys.exit(main())
