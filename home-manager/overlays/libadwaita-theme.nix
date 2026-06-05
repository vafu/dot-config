_final: prev:

{
  libadwaita = prev.libadwaita.overrideAttrs (oldAttrs: {
    pname = "${oldAttrs.pname}-without-adwaita";
    doCheck = false;
    patches = (oldAttrs.patches or [ ]) ++ [ ../theming_patch.diff ];
  });
}
