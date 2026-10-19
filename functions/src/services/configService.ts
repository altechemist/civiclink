import type { z } from 'zod';
import type { upsertCategorySchema, upsertDepartmentSchema } from '@civiclink/shared';
import type { DepartmentDoc } from '@civiclink/shared';
import type { Actor } from '../lib/command';
import { invalid, notFound } from '../lib/errors';
import { col, db } from '../lib/firebase';
import { writeLog } from './logService';

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** FR-21: departments and categories. Names are unique (case-insensitive); ids are stable slugs. */
export class ConfigService {
  async upsertDepartment(input: z.infer<typeof upsertDepartmentSchema>, actor: Actor) {
    const id = input.id ?? slug(input.name);
    await db.runTransaction(async (tx) => {
      const same = await tx.get(col.departments().where('nameLower', '==', input.name.toLowerCase()));
      if (same.docs.some((d) => d.id !== id)) throw invalid('name', 'A department with this name exists');
      if (input.id && !(await tx.get(col.departments().doc(id))).exists) throw notFound('Department');
      tx.set(col.departments().doc(id), {
        name: input.name, nameLower: input.name.toLowerCase(), slaHours: input.slaHours, isActive: input.isActive,
      });
    });
    await writeLog('INFO', 'admin.upsertDepartment', `${actor.name} saved department ${input.name}`, actor.uid);
    return { id };
  }

  async upsertCategory(input: z.infer<typeof upsertCategorySchema>, actor: Actor) {
    const id = input.id ?? slug(input.name);
    await db.runTransaction(async (tx) => {
      const same = await tx.get(col.categories().where('nameLower', '==', input.name.toLowerCase()));
      if (same.docs.some((d) => d.id !== id)) throw invalid('name', 'A category with this name exists');
      const dept = (await tx.get(col.departments().doc(input.departmentId))).data() as DepartmentDoc | undefined;
      if (!dept) throw invalid('departmentId', 'Choose a department');
      if (input.id && !(await tx.get(col.categories().doc(id))).exists) throw notFound('Category');
      tx.set(col.categories().doc(id), {
        name: input.name, nameLower: input.name.toLowerCase(), icon: input.icon, departmentId: input.departmentId, isActive: input.isActive,
      });
    });
    await writeLog('INFO', 'admin.upsertCategory', `${actor.name} saved category ${input.name}`, actor.uid);
    return { id };
  }
}
