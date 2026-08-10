#!/bin/bash
bad=0
for f in "$@"; do
  hits=$(grep -nEio '\$(pid|pwd|host|home|args|input|matches|error|this|profile|psitem|shellid|true|false|null|_)[[:space:]]*=' "$f")
  if [ -n "$hits" ]; then echo "RESERVED NAME in $f:"; echo "$hits"; bad=1; fi
done
[ $bad -eq 0 ] && echo "lint ok: no assignments to PowerShell automatic variables"
exit $bad
