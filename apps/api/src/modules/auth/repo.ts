import { prisma, type Db } from '../../lib/prisma';

export function cariUserDenganEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { kelas: { select: { nama_kelas: true } } },
  });
}

export function cariUserDenganId(id: number, db: Db = prisma) {
  return db.user.findUnique({ where: { id } });
}

export function simpanPassword(db: Db, id: number, hash: string) {
  return db.user.update({ where: { id }, data: { password: hash } });
}
