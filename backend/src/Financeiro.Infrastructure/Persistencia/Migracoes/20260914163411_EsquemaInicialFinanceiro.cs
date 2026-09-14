using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Financeiro.Infrastructure.Persistencia.Migracoes
{
    /// <inheritdoc />
    public partial class EsquemaInicialFinanceiro : Migration
    {
        // Colunas dos indices em campos 'static readonly' e nao em literais de
        // matriz: e o que o gerador do EF produz por padrao, e o analisador
        // (CA1861) recusa matriz constante repassada a metodo. Preferimos ajustar o
        // codigo gerado a desligar a regra para a pasta inteira de migrations.
        private static readonly string[] ColunasDoIndiceDeSincronizacao =
            ["usuario_id", "atualizado_em", "id"];

        private static readonly string[] ColunasDoIndiceDePeriodo =
            ["usuario_id", "data", "id"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);

            migrationBuilder.EnsureSchema(
                name: "financeiro");

            migrationBuilder.CreateTable(
                name: "transacoes",
                schema: "financeiro",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<string>(type: "varchar(10)", nullable: false),
                    valor = table.Column<long>(type: "bigint", nullable: false),
                    data = table.Column<DateOnly>(type: "date", nullable: false),
                    descricao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    categoria_id = table.Column<Guid>(type: "uuid", nullable: false),
                    conta_id = table.Column<Guid>(type: "uuid", nullable: true),
                    atualizado_em = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    excluido_em = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true)
                },
                constraints: table =>
                {
                    // Chave primaria COMPOSTA. O id vem do cliente offline, entao dois
                    // usuarios podem emitir o mesmo UUID; sem o dono na chave isso seria
                    // colisao de unicidade ou linha de uma conta alcancavel pela outra.
                    table.PrimaryKey("PK_transacoes", x => new { x.usuario_id, x.id });
                });

            // Indice do keyset do pull: mesma ordem da tupla comparada
            // (usuario_id, atualizado_em, id), para que a pagina seja um seek e nao
            // uma varredura filtrada.
            migrationBuilder.CreateIndex(
                name: "ix_transacoes_usuario_atualizado_id",
                schema: "financeiro",
                table: "transacoes",
                columns: ColunasDoIndiceDeSincronizacao);

            migrationBuilder.CreateIndex(
                name: "ix_transacoes_usuario_data_id",
                schema: "financeiro",
                table: "transacoes",
                columns: ColunasDoIndiceDePeriodo);

            // Exclusao e logica, sempre. A linha excluida continua na tabela porque e
            // so por ela que um aparelho que estava offline descobre o que sumiu; um
            // DELETE fisico apagaria a propria noticia da exclusao.
            //
            // O gatilho e a versao dessa regra que nao depende de ninguem lembrar
            // dela: vale para o repositorio, para um script de manutencao e para
            // alguem com um psql aberto. E de nivel STATEMENT para disparar tambem no
            // DELETE que nao casa com nenhuma linha — o comando e que esta proibido,
            // nao o efeito.
            migrationBuilder.Sql(
                """
                CREATE OR REPLACE FUNCTION financeiro.impedir_delete_fisico()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    RAISE EXCEPTION
                        'DELETE fisico proibido em %.%: exclusao e logica (preencha excluido_em)',
                        TG_TABLE_SCHEMA, TG_TABLE_NAME
                        USING ERRCODE = 'restrict_violation';
                END;
                $$;
                """);

            migrationBuilder.Sql(
                """
                CREATE TRIGGER transacoes_sem_delete
                BEFORE DELETE ON financeiro.transacoes
                FOR EACH STATEMENT
                EXECUTE FUNCTION financeiro.impedir_delete_fisico();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            ArgumentNullException.ThrowIfNull(migrationBuilder);

            migrationBuilder.Sql("DROP TRIGGER IF EXISTS transacoes_sem_delete ON financeiro.transacoes;");
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS financeiro.impedir_delete_fisico();");

            migrationBuilder.DropTable(
                name: "transacoes",
                schema: "financeiro");
        }
    }
}
