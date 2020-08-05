source $1 $@

echo "## Serving a spica instance"

NAME="${TAG//_/-}"

# FD 5
exec 5>&1


# Test if --retain-volumes=false removes volumes
spica serve $NAME --force --version=$TAG --image-pull-policy=if-not-present --no-open

CLI_OUTPUT=$(spica rm $NAME --retain-volumes=false 2>&1 | tee /dev/fd/5; exit ${PIPESTATUS[0]})

assert_contains "$CLI_OUTPUT" "Removing volumes (0/2)"
assert_contains "$CLI_OUTPUT" "Removing volumes (2/2)"

DOCKER_OUTPUT=$(docker volume ls 2>&1 | tee /dev/fd/5; exit ${PIPESTATUS[0]})

assert_not_contains "$DOCKER_OUTPUT" "$NAME" 

# Test if --retain-volumes=true retains volumes
spica serve $NAME --force --version=$TAG --image-pull-policy=if-not-present --no-open

CLI_OUTPUT=$(spica rm $NAME --retain-volumes=true 2>&1 | tee /dev/fd/5; exit ${PIPESTATUS[0]})

assert_not_contains "$CLI_OUTPUT" "Removing volumes"

DOCKER_OUTPUT=$(docker volume ls 2>&1 | tee /dev/fd/5; exit ${PIPESTATUS[0]})

assert_contains "$DOCKER_OUTPUT" "$NAME" 

echo ""
echo "## All tests have passed. Cleaning"
echo ""
