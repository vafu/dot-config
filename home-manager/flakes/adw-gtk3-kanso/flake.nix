{
  description = "Kanso adw-gtk3 theme";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in rec {
          adw-gtk3-kanso = pkgs.stdenvNoCC.mkDerivation {
            pname = "adw-gtk3-kanso";
            version = "2026-06-05";

            src = pkgs.fetchFromGitHub {
              owner = "vafu";
              repo = "adw-gtk3";
              rev = "95c7d65929851115e57fe82300520b899757ca14";
              hash = "sha256-t9AceORJfQ/Wrixm0DlfqxCklWci3DSACAMqDY9zQLs=";
            };

            nativeBuildInputs = with pkgs; [
              meson
              ninja
              dart-sass
            ];

            meta = with pkgs.lib; {
              description = "Kanso variant of the adw-gtk3 theme";
              homepage = "https://github.com/vafu/adw-gtk3/tree/kanso";
              license = licenses.lgpl21Only;
              platforms = platforms.linux;
            };
          };

          default = adw-gtk3-kanso;
        });
    };
}
