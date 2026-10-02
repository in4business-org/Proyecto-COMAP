const {
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');

// Grupos del User Pool que representan los roles de la app.
// La verdad sobre el rol de un usuario vive en Cognito (no en Postgres):
// el ID token ya trae `cognito:groups`, así que el backend no necesita
// consultar la base en cada request.
//   admins         -> master: ve y administra TODA la plataforma
//   admins_empresa -> admin de empresa: administra usuarios, pero solo dentro
//                     de las empresas que un master le dio visibilidad
//   usuarios       -> usuario normal
//
// Ojo: `admins` sigue significando master. Se mantuvo el nombre a proposito
// para no tener que migrar a los administradores que ya existian: si se le
// hubiera cambiado el sentido, habrian quedado degradados de golpe.
const GROUP_MASTER = 'admins';
const GROUP_ADMIN_EMPRESA = 'admins_empresa';
const GROUP_USER = 'usuarios';

// Alias historico: antes de los tres niveles esto era "el grupo de admins".
const GROUP_ADMIN = GROUP_MASTER;

// Mismo criterio que s3.config.js: en Vercel/Lambda los nombres AWS_* están
// reservados, por eso aceptamos COGNITO_* primero y caemos a S3_* / AWS_*.
// En EC2/ECS con IAM Role no hace falta ninguna credencial explícita.
const REGION =
  process.env.COGNITO_REGION ||
  process.env.S3_REGION ||
  process.env.AWS_REGION ||
  'us-east-1';
const accessKeyId =
  process.env.COGNITO_ACCESS_KEY_ID ||
  process.env.S3_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.COGNITO_SECRET_ACCESS_KEY ||
  process.env.S3_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY;

const cognito = new CognitoIdentityProviderClient({
  region: REGION,
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

const ROLES = ['master', 'admin_empresa', 'user'];

/**
 * Traduce la lista de grupos de Cognito a un rol de la app.
 * `master` gana sobre `admin_empresa`. Quien no esté en ningún grupo cuenta
 * como usuario normal, así nada se rompe si alguien fue creado fuera del panel.
 *
 * Los valores son deliberadamente distintos del viejo 'admin': si quedara
 * alguna comparación sin actualizar, falla cerrada (deniega) en vez de
 * conceder permisos de más.
 *
 * @param {string[]|undefined} groups
 * @returns {'master'|'admin_empresa'|'user'}
 */
function roleFromGroups(groups) {
  if (!Array.isArray(groups)) return 'user';
  if (groups.includes(GROUP_MASTER)) return 'master';
  if (groups.includes(GROUP_ADMIN_EMPRESA)) return 'admin_empresa';
  return 'user';
}

/** Grupo de Cognito que corresponde a cada rol. */
function groupForRole(rol) {
  if (rol === 'master') return GROUP_MASTER;
  if (rol === 'admin_empresa') return GROUP_ADMIN_EMPRESA;
  return GROUP_USER;
}

/** ¿Puede entrar al panel de administración? */
function puedeAdministrar(rol) {
  return rol === 'master' || rol === 'admin_empresa';
}

module.exports = {
  cognito,
  USER_POOL_ID,
  GROUP_MASTER,
  GROUP_ADMIN_EMPRESA,
  GROUP_USER,
  GROUP_ADMIN,
  ROLES,
  roleFromGroups,
  groupForRole,
  puedeAdministrar,
};
