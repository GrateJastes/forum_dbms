FROM ubuntu:16.04

MAINTAINER Ermilov Nikita

ENV TZ=Russia/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
# Обвновление списка пакетов
RUN apt-get -y update
RUN apt-get install -y wget
RUN DEBIAN_FRONTEND="noninteractive" apt-get -y install tzdata

RUN sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt xenial-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
RUN wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
RUN apt-get -y update

#
# Установка postgresql
#
ENV PGVER 13
RUN apt-get install -y postgresql-$PGVER

# Run the rest of the commands as the ``postgres`` user created by the ``postgres-$PGVER`` package when it was ``apt-get installed``
USER postgres

# Create a PostgreSQL role named ``docker`` with ``docker`` as the password and
# then create a database `docker` owned by the ``docker`` role.
RUN /etc/init.d/postgresql start &&\
    psql --command "CREATE USER docker WITH SUPERUSER PASSWORD 'docker';" &&\
    createdb -O docker docker &&\
    /etc/init.d/postgresql stop

# Adjust PostgreSQL configuration so that remote connections to the
# database are possible.
RUN echo "host all  all    0.0.0.0/0  md5" >> /etc/postgresql/$PGVER/main/pg_hba.conf

# And add ``listen_addresses`` to ``/etc/postgresql/$PGVER/main/postgresql.conf``
RUN echo "listen_addresses='*'" >> /etc/postgresql/$PGVER/main/postgresql.conf

# Expose the PostgreSQL port
EXPOSE 5432

# Add VOLUMEs to allow backup of config, logs and databases
VOLUME  ["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]

# Back to the root user
USER root

#
# Сборка проекта
#

RUN apt-get install -y curl
RUN curl --silent --location https://deb.nodesource.com/setup_15.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y build-essential

WORKDIR /usr/src/forum_app

COPY package.json ./
RUN npm install

COPY . .

# Объявлем порт сервера
EXPOSE 5000

ENV PGPASSWORD docker
#
# Запускаем PostgreSQL и сервер
#
CMD service postgresql start && psql -h localhost -d docker -U docker -p 5432 -a -q -f ./database/create_db.sql && npm run dev
