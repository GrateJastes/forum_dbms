FROM golang:latest as goserver

RUN mkdir /app

COPY . /app

WORKDIR /app

RUN go build -o main main.go

FROM ubuntu:20.04

RUN apt-get -y update && apt-get install -y tzdata

ENV PGVER 12
RUN apt-get -y update && apt-get install -y postgresql-$PGVER
USER postgres

ADD ./storage/migrations/up.sql .

ENV PGPASSWORD docker
RUN /etc/init.d/postgresql start &&\
    psql --command "CREATE USER docker WITH SUPERUSER PASSWORD 'docker';" &&\
    createdb -O docker forum_db &&\
    psql -h localhost -d forum_db -U docker -p 5432 -a -q -f up.sql &&\
    /etc/init.d/postgresql stop

VOLUME  ["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]

COPY --from=goserver /app .

USER root

EXPOSE 5000/tcp

CMD service postgresql start && ./main
