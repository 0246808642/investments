using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Financeiro.Infrastructure.Identidade.Migracoes
{
    /// <inheritdoc />
    public partial class AdicionaNomeDoUsuario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Nome",
                schema: "identidade",
                table: "AspNetUsers",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Nome",
                schema: "identidade",
                table: "AspNetUsers");
        }
    }
}
