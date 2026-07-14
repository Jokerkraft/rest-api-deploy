import mysql from 'mysql2/promise'

const DEFAULT_CONFIG = {
  host: 'localhost',
  user: 'root',
  port: 3306,
  password: '',
  database: 'moviesdb'
}
const connectionString = process.env.DATABASE_URL ?? DEFAULT_CONFIG

const connection = await mysql.createConnection(connectionString)

export class MovieModel {
  static async getAll ({ genre }) {
    if (genre) {
      const lowerCaseGenre = genre.toLowerCase()

      // 1. Buscamos el ID del género según su nombre en minúsculas
      const [genres] = await connection.query(
        'SELECT id, name FROM genre WHERE LOWER(name) = ?;',
        [lowerCaseGenre]
      )

      if (genres.length === 0) return []

      const [{ id: genreId }] = genres

      // 2. Traemos las películas haciendo un JOIN con la tabla intermedia (movie_genres / movie_genre)
      // Ajusta los nombres de las tablas y campos si en tu DB cambian un poco.
      const [movies] = await connection.query(
        `SELECT m.title, m.year, m.director, m.duration, m.poster, m.rate, BIN_TO_UUID(m.id) id 
         FROM movie m
         INNER JOIN movie_genres mg ON m.id = mg.movie_id
         WHERE mg.genre_id = ?;`,
        [genreId]
      )

      return movies
    }

    // Si no hay filtro, retornamos todas
    const [movies] = await connection.query(
      'SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id FROM movie;'
    )

    return movies
  }

  static async getById ({ id }) {
    const [movies] = await connection.query(
      `SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id
        FROM movie WHERE id = UUID_TO_BIN(?);`,
      [id]
    )

    if (movies.length === 0) return null

    return movies[0]
  }

  static async create ({ input }) {
    const {
      genre: genreInput, // Es un arreglo de nombres de géneros, ej: ["Drama", "Action"]
      title,
      year,
      duration,
      director,
      rate,
      poster
    } = input

    // 1. Generamos el UUID en la base de datos
    const [uuidResult] = await connection.query('SELECT UUID() uuid;')
    const [{ uuid }] = uuidResult

    try {
      // 2. Insertamos la película en su tabla principal utilizando marcadores de posición (?) por seguridad
      await connection.query(
        `INSERT INTO movie (id, title, year, director, duration, poster, rate)
         VALUES (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?);`,
        [uuid, title, year, director, duration, poster, rate]
      )

      // 3. Relacionamos la película con sus géneros si el input los incluye
      if (genreInput && genreInput.length > 0) {
        for (const genreName of genreInput) {
          const [genreRows] = await connection.query(
            'SELECT id FROM genre WHERE LOWER(name) = ?;',
            [genreName.toLowerCase()]
          )

          // Si el género existe en la base de datos, creamos la relación en la tabla intermedia
          if (genreRows.length > 0) {
            const genreId = genreRows[0].id
            await connection.query(
              'INSERT INTO movie_genres (movie_id, genre_id) VALUES (UUID_TO_BIN(?), ?);',
              [uuid, genreId]
            )
          }
        }
      }
    } catch (e) {
      // Evitamos filtrar errores del motor de base de datos al cliente
      throw new Error('Error creating movie')
    }

    // 4. Retornamos la película recién creada
    const [movies] = await connection.query(
      `SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id
        FROM movie WHERE id = UUID_TO_BIN(?);`,
      [uuid]
    )

    return movies[0]
  }

  // --- EJERCICIO RESUELTO: DELETE ---
  static async delete ({ id }) {
    // Si tienes llaves foráneas con ON DELETE CASCADE en movie_genres,
    // al borrar la película se borrarán sus relaciones automáticamente.
    // De lo contrario, se debe borrar primero la relación de forma manual.
    try {
      // Opcional por seguridad (si no usas ON DELETE CASCADE):
      await connection.query(
        'DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?);',
        [id]
      )

      const [result] = await connection.query(
        'DELETE FROM movie WHERE id = UUID_TO_BIN(?);',
        [id]
      )

      // Retorna true si se eliminó un registro, false si no existía
      return result.affectedRows > 0
    } catch (e) {
      throw new Error('Error deleting movie')
    }
  }

  // --- EJERCICIO RESUELTO: UPDATE ---
  static async update ({ id, input }) {
    // Obtenemos solo las llaves que se van a actualizar para hacer un query dinámico
    const fieldsToUpdate = Object.keys(input).filter(key => key !== 'genre')

    if (fieldsToUpdate.length === 0 && !input.genre) return null

    try {
      if (fieldsToUpdate.length > 0) {
        // Construimos el SET dinámicamente: "title = ?, year = ?"
        const setString = fieldsToUpdate.map(key => `${key} = ?`).join(', ')
        const values = fieldsToUpdate.map(key => input[key])

        // Añadimos el ID al final del arreglo de valores para la cláusula WHERE
        values.push(id)

        await connection.query(
          `UPDATE movie SET ${setString} WHERE id = UUID_TO_BIN(?);`,
          values
        )
      }

      // Si también se enviaron géneros nuevos para actualizar
      if (input.genre) {
        // 1. Eliminamos las asociaciones viejas
        await connection.query(
          'DELETE FROM movie_genres WHERE movie_id = UUID_TO_BIN(?);',
          [id]
        )

        // 2. Agregamos las nuevas relaciones
        for (const genreName of input.genre) {
          const [genreRows] = await connection.query(
            'SELECT id FROM genre WHERE LOWER(name) = ?;',
            [genreName.toLowerCase()]
          )

          if (genreRows.length > 0) {
            const genreId = genreRows[0].id
            await connection.query(
              'INSERT INTO movie_genres (movie_id, genre_id) VALUES (UUID_TO_BIN(?), ?);',
              [id, genreId]
            )
          }
        }
      }

      // Retornamos la película actualizada
      return await this.getById({ id })
    } catch (e) {
      throw new Error('Error updating movie')
    }
  }
}
