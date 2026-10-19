#!/usr/bin/env python3
"""Splits src/10-class.puml into the two report-sized parts (10a domain, 10b services/logic)."""
from pathlib import Path

src = Path(__file__).parent / 'src'
s = (src / '10-class.puml').read_text()
body = s.split('\n', 3)[3]
ent = body.index('package "Domain entities'); logic = body.index('package "Domain logic'); svc = body.index('package "Application services')
rel = body.index('User "1" -- "0..*" Report'); dep = body.index('Command ..> ReportService'); end = body.index('@enduml')
hdr = '!include _style.iuml\nhide empty members\n'
(src / '10a-class-domain.puml').write_text('@startuml class-domain\n' + hdr + 'title Class design (1/2): domain entities and relationships\n'
                                           + body[ent:logic] + body[rel:dep].replace('ReportService ..> Settings : reads limit (BR-21)\n', '') + '@enduml\n')
stubs = 'package "Domain entities (see part 1)" {\n  class Report\n  class Task\n  class Alert\n  class User\n  class Settings\n}\n'
deps = body[dep:end]
(src / '10b-class-services.puml').write_text('@startuml class-services\n' + hdr + 'left to right direction\n'
                                             + 'title Class design (2/2): application services and domain logic\n'
                                             + body[svc:rel] + body[logic:svc] + stubs + deps + '@enduml\n')
