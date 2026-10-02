#!/usr/bin/env node
/**
 * Prepara el User Pool para el sistema de permisos:
 *   1. Crea los grupos `admins` y `usuarios` (idempotente).
 *   2. Opcionalmente promueve a un usuario existente a administrador.
 *
 * Uso:
 *   node scripts/setup-cognito-groups.js
 *   node scripts/setup-cognito-groups.js --admin uno@mail.com dos@mail.com
 *   node scripts/setup-cognito-groups.js --admin uno@mail.com,dos@mail.com
 *
 * Necesita las mismas credenciales que el backend (ver .env / ADMIN_SETUP.md).
 */
require('dotenv').config();

const {
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const {
  cognito,
  USER_POOL_ID,
  GROUP_MASTER,
  GROUP_ADMIN_EMPRESA,
  GROUP_USER,
} = require('../src/config/cognito.config');

async function crearGrupo(GroupName, Description, Precedence) {
  try {
    await cognito.send(
      new CreateGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName,
        Description,
        Precedence,
      })
    );
    console.log(`  ✓ grupo "${GroupName}" creado`);
  } catch (err) {
    if (err.name === 'GroupExistsException') {
      console.log(`  · grupo "${GroupName}" ya existía`);
      return;
    }
    throw err;
  }
}

async function main() {
  if (!USER_POOL_ID) {
    console.error('Falta COGNITO_USER_POOL_ID en el entorno.');
    process.exit(1);
  }

  console.log(`User Pool: ${USER_POOL_ID}`);
  await crearGrupo(GROUP_MASTER, 'Administrador general: toda la plataforma', 1);
  await crearGrupo(GROUP_ADMIN_EMPRESA, 'Administrador dentro de sus empresas', 5);
  await crearGrupo(GROUP_USER, 'Acceso normal a la plataforma', 10);

  const emails = parsearEmails();
  if (emails.length === 0) {
    console.log('\nListo. Para promover a alguien: --admin uno@mail.com dos@mail.com');
    return;
  }

  console.log(`\nPromoviendo ${emails.length} usuario(s) a "${GROUP_MASTER}":`);
  let fallaron = 0;
  for (const email of emails) {
    try {
      // Resolvemos el usuario primero: si el pool usa el email como alias,
      // el Username real puede ser un UUID.
      const { Username } = await cognito.send(
        new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email })
      );
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username,
          GroupName: GROUP_MASTER,
        })
      );
      console.log(`  ✓ ${email}`);
    } catch (err) {
      fallaron++;
      const motivo =
        err.name === 'UserNotFoundException'
          ? 'no existe en el User Pool'
          : `${err.name}: ${err.message}`;
      console.log(`  ✗ ${email} — ${motivo}`);
    }
  }

  console.log(
    '\nCada uno tiene que cerrar sesión y volver a entrar para que el ID token traiga el grupo.'
  );
  if (fallaron > 0) process.exitCode = 1;
}

/** Emails pasados con --admin: separados por espacios y/o comas. */
function parsearEmails() {
  const i = process.argv.indexOf('--admin');
  if (i === -1) return [];
  const emails = [];
  for (const arg of process.argv.slice(i + 1)) {
    if (arg.startsWith('--')) break;
    for (const parte of arg.split(',')) {
      const email = parte.trim().toLowerCase();
      if (email && !emails.includes(email)) emails.push(email);
    }
  }
  return emails;
}

main().catch((err) => {
  console.error(`\n✗ ${err.name}: ${err.message}`);
  process.exit(1);
});
