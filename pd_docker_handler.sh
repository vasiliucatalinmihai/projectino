#!/bin/bash

# docker operations for the `pd` manager

validateContainer() {
    local inputContainer="$1"
    for container in ${SUPPORTED_CONTAINERS[*]}; do
        if [ "${inputContainer}" == "${container}" ]; then
            return 0
        fi
    done
    echo "Please specify a valid container:" >&2
    for container in ${SUPPORTED_CONTAINERS[*]}; do
        printf "%s\n" "${container}"
    done
    exit 1
}

DOCKER_HANDLER_build() {
    local buildOptions="$@"
    echo -e "${BIGre}-> Building${RCol} ${buildOptions}"
    ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} build ${buildOptions}
    return $?
}

DOCKER_HANDLER_start() {
    local startOptions="$@"
    echo -e "-> ${BIGre}Starting docker${RCol} ${startOptions}"
    if [ -n "$startOptions" ]; then
        ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} up ${startOptions}
    else
        ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} up -d --remove-orphans
    fi
    return $?
}

DOCKER_HANDLER_stop() {
    local options="$@"
    echo "Stopping docker compose services..."
    ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} down -t 10 ${options}
}

DOCKER_HANDLER_restart() {
    if [ "$1" != "" ]; then
        validateContainer "$1"
        echo -e "-> ${BIGre}Restarting container${RCol} $1"
        ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} restart "$1"
    else
        echo -e "-> ${BIGre}Restarting ALL containers${RCol}"
        ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} restart
    fi
}

DOCKER_HANDLER_enter() {
    validateContainer "$1"
    local container="$1"; shift
    ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} exec "${container}" /bin/bash \
        || ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} exec "${container}" /bin/sh
}

DOCKER_HANDLER_logs() {
    local container="$1"
    if [ "${container}" == "all" ] || [ -z "${container}" ]; then
        ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} logs -f --tail 100
        return 0
    fi
    validateContainer "$1"
    ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} logs -f --tail 100 "${container}"
}

DOCKER_HANDLER_status() {
    ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} ps
}

DOCKER_HANDLER_stats() {
    ${DOCKER} ps -q | ${XARGS} ${DOCKER} inspect --format '{{.Name}}' | ${SED} 's:/::' | ${XARGS} ${DOCKER} stats
}

DOCKER_HANDLER_execute() {
    validateContainer "$1"
    local container="$1"; shift
    ${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} exec "${container}" ${@}
    return $?
}

DOCKER_HANDLER_cleanVolumes() {
    local container="$1"
    validateContainer "$container"
    local container_id
    container_id=$(${DOCKER_COMPOSE} ${DOCKER_COMPOSE_FILE} ps -q "$container")
    if [ -z "$container_id" ]; then
        echo "No container found for: $container"
        return 1
    fi
    local volumes
    volumes=$(docker inspect "$container_id" --format '{{ range .Mounts }}{{ if .Name }}{{ .Name }}{{ "\n" }}{{ end }}{{ end }}')
    for vol in $volumes; do
        echo "Removing volume: $vol"
        docker volume rm "$vol" || echo "Failed to remove volume: $vol"
    done
}
