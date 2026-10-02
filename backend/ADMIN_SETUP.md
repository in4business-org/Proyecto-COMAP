# Permisos y panel de administración

Los roles viven en **grupos de Cognito**, no en Postgres. El ID token que ya usa
la app trae el claim `cognito:groups`, así que el backend resuelve el rol sin
consultar la base en cada request y no hay dos fuentes de verdad que sincronizar.

| Grupo            | Rol en la app   | Puede                                                     |
| ---------------- | --------------- | --------------------------------------------------------- |
| `admins`         | `master`        | Todo: ve todas las empresas y administra toda la plataforma |
| `admins_empresa` | `admin_empresa` | Gestiona usuarios **sólo dentro de las empresas que le asignaron** |
| `usuarios`       | `user`          | Sólo usa la plataforma, en sus empresas                   |

Quien no esté en ningún grupo cuenta como usuario normal, así que nada se rompe
si una cuenta fue creada fuera del panel.

> `admins` sigue significando **master**. Se mantuvo el nombre a propósito: si se
> le hubiera cambiado el sentido para reutilizarlo como "admin de empresa", los
> administradores que ya existían habrían quedado degradados de golpe al
> desplegar.

---

## Qué hay que hacer en AWS

Tres cosas, una sola vez.

### 1. Crear los grupos y los primeros administradores

```bash
cd backend && npm run setup:cognito -- --admin uno@mail.com dos@mail.com
```

En **Windows PowerShell 5.1** el `&&` no existe como separador (da
`El token '&&' no es un separador de instrucciones válido`). Usá dos líneas:

```powershell
cd backend
npm run setup:cognito -- --admin uno@mail.com dos@mail.com
```

El script es idempotente: crea `admins` y `usuarios` si no existen y agrega cada
email al grupo `admins`. Los emails ya tienen que existir en el User Pool; los
que no existan se reportan y el resto se promueve igual.

Después de correrlo, **cada uno tiene que cerrar sesión y volver a entrar**: el
rol viaja en el ID token y el que tienen abierto todavía no trae el grupo.

(Equivalente a mano: Cognito → User pool → *Groups* → *Create group*, y después
*Users* → elegir el usuario → *Add to group*.)

### 2. Dar permisos de IAM a las credenciales del backend

El usuario/rol IAM que usa el backend necesita poder administrar el User Pool.
Reemplazá `<REGION>`, `<ACCOUNT_ID>` y `<USER_POOL_ID>`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AdministrarUsuariosDelPool",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:ListUsers",
        "cognito-idp:ListUsersInGroup",
        "cognito-idp:ListGroups",
        "cognito-idp:CreateGroup",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminEnableUser",
        "cognito-idp:AdminDisableUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminAddUserToGroup",
        "cognito-idp:AdminRemoveUserFromGroup",
        "cognito-idp:AdminListGroupsForUser"
      ],
      "Resource": "arn:aws:cognito-idp:<REGION>:<ACCOUNT_ID>:userpool/<USER_POOL_ID>"
    }
  ]
}
```

`CreateGroup` sólo hace falta para correr el script del paso 1; después se puede
sacar.

> Estas credenciales pueden crear y borrar cuentas: no las pongas en el frontend
> ni las compartas con el usuario IAM que sólo sube archivos a S3.

### 3. Variables de entorno

En `backend/.env` (y en Vercel / donde corra el backend):

```
COGNITO_REGION=us-east-1
COGNITO_ACCESS_KEY_ID=...
COGNITO_SECRET_ACCESS_KEY=...
```

Si el backend corre en EC2/ECS con IAM Role, alcanza con adjuntar la policy al
rol y no hace falta ninguna credencial explícita. Si no definís las `COGNITO_*`,
caen a `S3_*` y después a `AWS_*`.

### Opcional: email de invitación

Cognito manda el mail de alta con su remitente por defecto, con un límite de
**50 mails por día**. Para volumen mayor o un remitente propio hay que conectar
SES en *User pool → Messaging → Email*. Mientras tanto, en el panel se puede
desmarcar "enviar mail" y pasarle la contraseña temporal a mano.

---

## Cómo funciona

**Alta.** El panel llama a `AdminCreateUser` con una contraseña temporal random
y agrega al usuario a su grupo. En el primer login Cognito responde
`CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED` y la pantalla de Login ya pide la
contraseña definitiva — eso no hubo que tocarlo.

**Verificación.** `requireAuth` valida el JWT y deja `req.user.role` armado desde
`cognito:groups`; `requireAdmin` corta con 403 si no es `admin`. En el frontend,
`ProtectedRoute adminOnly` y el ítem del sidebar son sólo cosméticos: el control
real está en el backend.

**Propagación de cambios de rol.** El claim viaja dentro del ID token, así que un
cambio de rol se ve recién cuando el token se renueva (hasta 1 hora) o el usuario
vuelve a iniciar sesión. Para que aplique ya, deshabilitar y volver a habilitar
la cuenta corta las sesiones activas.

**Contraseñas.** El backend nunca las guarda. La temporal se genera en memoria y
se devuelve una sola vez cuando el admin eligió no mandar mail o pidió un reset.

## Permisos por empresa

Los roles (`admin` / `user`) dicen quién entra al panel. **Qué empresas ve cada
usuario y qué puede modificar** se guarda aparte, en Postgres, en la tabla
`UsuarioEmpresa`. No va en Cognito: los custom attributes tienen un límite de
2048 caracteres y no se pueden consultar con `join`.

- **Los administradores ven y editan todo.** No tienen filas en esa tabla:
  acceden por su rol.
- **Un usuario normal arranca sin nada** (deny-by-default). No ve ninguna
  empresa hasta que un admin se la asigne desde *Administración → icono de
  empresa* en la fila del usuario.
- **Tener la empresa asignada da lectura.** Encima de eso se marca, módulo por
  módulo, qué puede escribir: `empresa`, `proyectos`, `facturas`, `checklist`,
  `simulador`. Ninguno marcado = sólo lectura. Todos = escritura total.
- **Dar de alta empresas es sólo de administradores.**

### Administrador de empresa

Es una herramienta de gestión acotada: le permite a alguien administrar usuarios
dentro de las empresas que un master le dio, sin tocar nada del resto de la
plataforma.

**Puede**, siempre dentro de sus empresas:

- Entrar al panel y ver a los usuarios que tienen acceso a alguna de ellas.
  Nunca ve a los administradores generales, ni a usuarios de empresas ajenas.
  El resto de la app (listado de empresas, dashboard y estadísticas) también
  viene recortado a sus empresas.
- Crear usuarios normales (obligatoriamente asignándoles al menos una de sus
  empresas, si no quedarían fuera de su propio alcance).
- Asignar y quitar permisos por módulo.
- Resetear la contraseña, **sólo** si esa persona no pertenece además a alguna
  empresa que él no administre.

**No puede**, y acá está la frontera que impide la escalada:

- Cambiar roles — ni el propio ni el de nadie. Promover a `admin_empresa` o a
  `master` es exclusivo de un master.
- Crear administradores de ningún tipo.
- Ver ni tocar a los masters, ni a otros administradores de empresa.
- Deshabilitar o eliminar cuentas: afectan el acceso a toda la plataforma.
- Dar de alta empresas.

**El reemplazo de permisos es parcial.** Cuando guarda los permisos de alguien
que además pertenece a empresas que él no administra, sólo se reescribe su
porción: lo de las otras empresas queda intacto.

**Tiene control total sobre los datos de sus empresas.** Al asignarle una
empresa sólo se elige *cuál*, no permisos por módulo: adentro puede todo. No
tendría sentido que reparta permisos de escritura que él mismo no tiene.

Técnicamente la columna `escritura` de sus filas se ignora: la fila sólo define
qué empresas administra. Si más adelante lo degradan a usuario normal, vuelve a
regir lo que haya guardado ahí — vacío, o sea sólo lectura, hasta que un master
le configure los módulos. Falla cerrada.

La elección de lectura/escritura por módulo existe únicamente para los usuarios
normales.

### Cómo se aplica

`cargarAcceso` se monta una sola vez sobre `/api/empresas/:empresaId`, que es el
prefijo de **todas** las rutas con alcance de empresa (proyectos, facturas,
checklist y simulador cuelgan de ahí), así que no hay forma de saltearlo. Deja
el acceso en `req.acceso` y corta con **404** —no 403— si el usuario no tiene
lectura: un 403 le confirmaría que ese id existe.

Encima de eso, cada ruta que modifica algo lleva `requireEscritura('<modulo>')`
como middleware **de ruta**. Importa que sea por ruta y no con `router.use`:
`use` matchea por prefijo, y como todo cuelga de
`/empresas/:empresaId/proyectos/...`, un guard montado así se dispara también
sobre las rutas de los otros módulos y termina pidiendo el permiso equivocado.

Las rutas de sólo lectura no llevan guard, incluido el POST de exportar a Excel,
que es un POST pero no modifica nada.

El frontend usa `/api/me` para ocultar lo que el usuario no puede hacer, pero eso
es cosmético: la decisión real la toma siempre el backend.

### Tests

```bash
cd backend && npm test
```

Cubren la resolución de permisos y, sobre la app real montada como en
producción, que una empresa ajena dé 404 y que cada módulo exija su propio
permiso de escritura.

## Endpoints

Todos bajo `requireAuth + requireAdmin`:

| Método | Ruta                                          | Qué hace                          |
| ------ | --------------------------------------------- | --------------------------------- |
| GET    | `/api/admin/usuarios`                         | Lista usuarios con rol y estado   |
| POST   | `/api/admin/usuarios`                         | Crea usuario y lo asigna al grupo |
| PATCH  | `/api/admin/usuarios/:username/rol`           | Cambia el rol — **sólo master**   |
| PATCH  | `/api/admin/usuarios/:username/estado`        | Habilita / deshabilita — **sólo master** |
| POST   | `/api/admin/usuarios/:username/reset-password`| Nueva contraseña temporal         |
| DELETE | `/api/admin/usuarios/:username`               | Borra la cuenta — **sólo master** |
| GET    | `/api/admin/contexto`                         | Rol y empresas que administro     |
| GET    | `/api/admin/modulos`                          | Módulos que admiten escritura     |
| GET    | `/api/admin/usuarios/:username/accesos`       | Permisos por empresa del usuario  |
| PUT    | `/api/admin/usuarios/:username/accesos`       | Reemplaza el set de permisos      |

Un master no puede cambiarse el rol, deshabilitarse ni borrarse a sí mismo
(se valida por `sub`, en el backend), para que no quede la app sin
administradores.

`GET /api/me` devuelve identidad y rol del usuario autenticado.
