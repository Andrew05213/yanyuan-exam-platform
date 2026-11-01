"""Keep the merged school metadata and generic stock scopes reproducible."""
import copy
import json
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('school-tracks.json').read_text(encoding='utf-8'))
NEW_SCHOOLS = ['whu', 'sisu', 'nju', 'fudan']


def apply_schools(data):
    for key in ['version', 'updated', 'policyNote', 'languages', 'schools']:
        data[key] = copy.deepcopy(CATALOG[key])
    for item in data['oralItems']:
        item.update(copy.deepcopy(CATALOG['oralMetadata'].get(item['id'], {})))
        if item['id'] == 'speit-self-introduction':
            item['title'] = 'Self-introduction · 上海交通大学'
    # Keep authored prompts separate from school policy and preserve legacy IDs.
    topics = json.loads(Path(__file__).with_name('country-topics.json').read_text(encoding='utf-8'))
    existing = {item['id'] for item in data['oralItems']}
    for lang, meta in data['languages'].items():
        data['types'][meta['countryType']] = meta['label'] + '国别类问题回答'
        for index, title in enumerate(topics[lang]):
            item_id = f'country-{lang}-{index + 1:02}'
            if item_id in existing:
                continue
            level = ['基础', '进阶', '挑战'][index // 2]
            guide = ['明确讨论对象与时间、地区范围，解释题目中的关键概念。',
                     '针对“' + title + '”选择一个作品、地点或语言使用场景，以可核查材料支持论点。',
                     '区分事实与个人判断，回应一个反例，避免以单一个案代表整个语言共同体。']
            data['oralItems'].append(dict(
                id=item_id, schoolIds=[s['id'] for s in data['schools'] if lang in s['languageIds']],
                type=meta['countryType'], countryLanguageId=lang, schoolSpecific=False,
                title=title, prompt='围绕' + meta['scope'] + '作答。可用中文或英语；具备基础时可用目标语。先给出判断，再用具体例子解释，并回应追问。原创拓展训练，不认定为学校真题或必考题。',
                guide=guide, followups=['你会用什么资料核实刚才的例子？', '换一个地区、时期或群体，你的结论还成立吗？'],
                level=level, text='', reference='开放题没有唯一答案。参考组织：界定范围—具体例证—解释联系—讨论反例与限制。' + '；'.join(guide),
                source={'label': '本站原创国别与区域研究训练题；例证由作答者核实', 'kind': '原创命题'},
                language='中文 / English / 目标语（自选）', prepSeconds=60, answerSeconds=150,
                terms=[], version='country-1.0'))
    return data


def extend_scope(items):
    for item in items:
        if item.get('schoolIds'):
            item['schoolIds'] = list(dict.fromkeys(item['schoolIds'] + NEW_SCHOOLS))


def apply_workflows(data):
    data['profiles'] = copy.deepcopy(CATALOG['profiles'])
    extend_scope(data['readings'])
    extend_scope(data['translations'])
    return data


def apply_difficulty(data):
    extend_scope([item for item in data['items'] if item['section'] in ['reading', 'translation']])
    return data

